import { mainCanvas } from '../state'
import { decodeGif, gifFrameIndex, closeGif, mayBeAnimated, type GifAnim } from './gif'
import { animTime } from './base'

// Two photo or video layers drawn under the drawing, each with its own
// opacity and colour grading. Layer 0 is at the bottom.

export const GRADES = [
  { key: 'exposure',    label: 'exposure',    min: -100, max: 100 },
  { key: 'contrast',    label: 'contrast',    min: -100, max: 100 },
  { key: 'saturation',  label: 'saturation',  min: -100, max: 100 },
  { key: 'temperature', label: 'temperature', min: -100, max: 100 },
  { key: 'tint',        label: 'tint',        min: -100, max: 100 },
  { key: 'hue',         label: 'hue',         min: -180, max: 180 },
] as const

export type GradeKey = typeof GRADES[number]['key']

type Media = HTMLImageElement | HTMLVideoElement | GifAnim

const isGif = (m: Media): m is GifAnim => 'frames' in m

export interface BgLayer {
  media: Media | null
  url: string | null
  name: string
  opacity: number
  grade: Record<GradeKey, number>
  /** The layer's file, which exports decode videos from. */
  file: File | null
  /** A video's own sound, mixed into the track. Fades are at the start and end of the timeline. */
  audio: AudioBuffer | null
  volume: number
  fadeIn: number
  fadeOut: number
}

const neutralGrade = (): Record<GradeKey, number> =>
  ({ exposure: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, hue: 0 })

export const bgLayers: BgLayer[] = [0, 1].map(() => ({
  media: null, url: null, name: '', opacity: 100, grade: neutralGrade(),
  file: null, audio: null, volume: 100, fadeIn: 0, fadeOut: 0,
}))

/** During an export, the decoded video frame to draw for each layer instead of its <video>. */
export const exportFrames: (VideoFrame | null)[] = bgLayers.map(() => null)

/** How the drawing sits on the backgrounds. 'screen' lets a black background show them through. */
export const bgSettings = { blend: 'source-over' as 'source-over' | 'screen' }

export const bgCanvas = document.getElementById('bgCanvas') as HTMLCanvasElement
const bgCtx = bgCanvas.getContext('2d')!
// Each layer is graded on its own canvas first, so temperature and tint don't spill onto the layer below.
const layerCanvas = document.createElement('canvas')
const layerCtx = layerCanvas.getContext('2d')!

export function resetGrade(layer: BgLayer): void {
  layer.grade = neutralGrade()
}

export function hasBackground(): boolean {
  return bgLayers.some(l => l.media && l.opacity > 0)
}

function mediaSize(media: Media): [number, number] {
  if (isGif(media)) return [media.width, media.height]
  return media instanceof HTMLVideoElement
    ? [media.videoWidth, media.videoHeight]
    : [media.naturalWidth, media.naturalHeight]
}

function cssFilter(g: Record<GradeKey, number>): string {
  const exposure = Math.pow(2, g.exposure / 100)
  return `brightness(${exposure}) contrast(${1 + g.contrast / 100}) saturate(${1 + g.saturation / 100}) hue-rotate(${g.hue}deg)`
}

/** Washes the layer with a colour in soft-light: warm/cool for temperature, magenta/green for tint. */
function wash(amount: number, positive: string, negative: string, w: number, h: number): void {
  if (amount === 0) return
  layerCtx.globalCompositeOperation = 'soft-light'
  layerCtx.globalAlpha = Math.abs(amount) / 100 * 0.6
  layerCtx.fillStyle = amount > 0 ? positive : negative
  layerCtx.fillRect(0, 0, w, h)
  layerCtx.globalCompositeOperation = 'source-over'
  layerCtx.globalAlpha = 1
}

export function renderBackgrounds(): void {
  const w = bgCanvas.width, h = bgCanvas.height
  bgCtx.clearRect(0, 0, w, h)
  for (const [i, layer] of bgLayers.entries()) {
    if (!layer.media || layer.opacity <= 0) continue
    const [mw, mh] = mediaSize(layer.media)
    if (!mw || !mh) continue

    if (layerCanvas.width !== w || layerCanvas.height !== h) {
      layerCanvas.width = w
      layerCanvas.height = h
    }
    // Cover: fill the whole frame, cropping the overflow.
    const scale = Math.max(w / mw, h / mh)
    const dw = mw * scale, dh = mh * scale
    layerCtx.clearRect(0, 0, w, h)
    layerCtx.filter = cssFilter(layer.grade)
    const source = exportFrames[i]
      ?? (isGif(layer.media) ? layer.media.frames[gifFrameIndex(layer.media, animTime())] : layer.media)
    layerCtx.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh)
    layerCtx.filter = 'none'
    wash(layer.grade.temperature, 'rgb(255,140,40)', 'rgb(40,120,255)', w, h)
    wash(layer.grade.tint, 'rgb(255,40,220)', 'rgb(40,255,90)', w, h)

    bgCtx.globalAlpha = layer.opacity / 100
    bgCtx.drawImage(layerCanvas, 0, 0)
  }
  bgCtx.globalAlpha = 1
}

export function resizeBackgrounds(): void {
  bgCanvas.width = mainCanvas.width
  bgCanvas.height = mainCanvas.height
  renderBackgrounds()
}

export function applyBlend(): void {
  mainCanvas.style.mixBlendMode = bgSettings.blend === 'screen' ? 'screen' : 'normal'
}

const videos = (): HTMLVideoElement[] =>
  bgLayers.map(l => l.media).filter((m): m is HTMLVideoElement => m instanceof HTMLVideoElement)

export function hasVideo(): boolean {
  return videos().length > 0
}

export function playVideos(): void {
  videos().forEach(v => { v.play().catch(() => { /* autoplay refused; the frame stays still */ }) })
}

export function pauseVideos(): void {
  videos().forEach(v => v.pause())
}

/** Jumps background videos to `t` seconds on the timeline, without waiting (live playback). */
export function syncVideos(t: number): void {
  videos().forEach(v => { if (v.duration) v.currentTime = t % v.duration })
}

/** Puts every background video at `t` seconds (looped), for frame-exact offline renders. */
export function seekVideos(t: number): Promise<void> {
  return Promise.all(videos().map(v => new Promise<void>(resolve => {
    const target = v.duration ? t % v.duration : 0
    if (Math.abs(v.currentTime - target) < 0.001) return resolve()
    v.addEventListener('seeked', () => resolve(), { once: true })
    // A seek that never reports back would stall the export; after a second, use whatever frame is showing.
    setTimeout(resolve, 1000)
    v.currentTime = target
  }))).then(() => undefined)
}

export function loadBackground(index: number, file: File, isPlaying: boolean, onReady: () => void): boolean {
  const isVideo = file.type.startsWith('video/')
  if (!isVideo && !file.type.startsWith('image/')) return false
  const layer = bgLayers[index]
  clearBackground(index)
  layer.url = URL.createObjectURL(file)
  layer.name = file.name
  layer.file = file

  if (isVideo) {
    const video = document.createElement('video')
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.preload = 'auto'
    video.addEventListener('loadeddata', () => {
      if (layer.media !== video) return
      if (isPlaying) video.play().catch(() => {})
      onReady()
    }, { once: true })
    video.src = layer.url
    layer.media = video
  } else if (mayBeAnimated(file)) {
    // Decoded into frames so it animates; a still image, or a browser that can't decode, gets the image.
    const img = new Image()
    img.src = layer.url
    layer.media = img
    decodeGif(file).catch(() => null).then(anim => {
      if (layer.media !== img) return closeGif(anim)
      if (anim) layer.media = anim
      if (img.complete) onReady(); else img.onload = () => { if (layer.media === img || layer.media === anim) onReady() }
    })
  } else {
    const img = new Image()
    img.onload = () => { if (layer.media === img) onReady() }
    img.src = layer.url
    layer.media = img
  }
  return true
}

export function clearBackground(index: number): void {
  const layer = bgLayers[index]
  if (layer.media instanceof HTMLVideoElement) {
    layer.media.pause()
    layer.media.removeAttribute('src')
    layer.media.load()
  } else if (layer.media && isGif(layer.media)) {
    closeGif(layer.media)
  }
  if (layer.url) URL.revokeObjectURL(layer.url)
  layer.media = null
  layer.url = null
  layer.name = ''
  layer.file = null
  layer.audio = null
}
