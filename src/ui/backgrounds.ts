import { state, mCtx, mainCanvas } from '../state'
import {
  GRADES, bgLayers, bgSettings, renderBackgrounds, loadBackground, clearBackground,
  resetGrade, applyBlend, type BgLayer,
} from '../core/backgrounds'

import { decodeSound } from '../core/sound'
import { soundEdited } from './sound'

const PROMPT = 'tap or drop a photo or video'

/** Each layer's file, kept for drafts, and its loader, used to restore one. */
export const layerFiles: (File | null)[] = bgLayers.map(() => null)
const loaders: ((file: File) => void)[] = []
export const loadLayerFile = (i: number, file: File): void => loaders[i](file)

const dirty = (): void => { document.dispatchEvent(new Event('draft:dirty')) }

function layerHtml(i: number): string {
  const grades = GRADES.map(g => `
        <div class="slider-row"><span class="slider-label">${g.label}</span><input type="range" id="bg${i}-${g.key}" data-grade="${g.key}" min="${g.min}" max="${g.max}" value="0"><span class="slider-val" data-grade-val="${g.key}">0</span></div>`).join('')
  return `
    <div class="bg-layer" data-layer="${i}">
      <div class="bg-layer-head">
        <span class="bg-layer-title">background ${i + 1}${i === 0 ? ' · back' : ' · front'}</span>
        <button type="button" class="bg-remove" hidden>remove ×</button>
      </div>
      <button type="button" class="file-slot">${PROMPT}</button>
      <input type="file" accept="image/*,video/*" hidden>
      <div class="slider-row"><span class="slider-label">opacity</span><input type="range" id="bg${i}-opacity" data-opacity min="0" max="100" value="100"><span class="slider-val" data-opacity-val>100</span></div>
      <div class="fx-block">
        <div class="fx-header">
          <span class="bg-grade-title">grading</span>
          <button type="button" class="fx-expand" data-target="grade-${i}">▾</button>
        </div>
        <div class="fx-params" id="grade-${i}">${grades}
          <button type="button" class="btn quiet" data-grade-reset>reset grading</button>
        </div>
      </div>
      <div class="bg-sound" data-sound hidden>
        <div class="slider-row"><span class="slider-label">volume</span><input type="range" id="bg${i}-volume" data-volume min="0" max="100" value="100"><span class="slider-val" data-volume-val>100</span></div>
        <div class="slider-row"><span class="slider-label">fade in</span><input type="range" id="bg${i}-fadeIn" data-fade="fadeIn" min="0" max="10" step="0.1" value="0"><span class="slider-val" data-fade-val="fadeIn">0.0s</span></div>
        <div class="slider-row"><span class="slider-label">fade out</span><input type="range" id="bg${i}-fadeOut" data-fade="fadeOut" min="0" max="10" step="0.1" value="0"><span class="slider-val" data-fade-val="fadeOut">0.0s</span></div>
        <div class="note">the video's sound, looped with it. fades are at the start and end of the timeline.</div>
      </div>
    </div>`
}

function syncLayer(el: HTMLElement, layer: BgLayer): void {
  const slot = el.querySelector<HTMLButtonElement>('.file-slot')!
  slot.textContent = layer.name || PROMPT
  slot.classList.toggle('loaded', !!layer.media)
  el.querySelector<HTMLButtonElement>('.bg-remove')!.hidden = !layer.media
  el.querySelector<HTMLElement>('[data-sound]')!.hidden = !layer.audio
  el.querySelector<HTMLInputElement>('[data-volume]')!.value = String(layer.volume)
  el.querySelector('[data-volume-val]')!.textContent = String(layer.volume)
  for (const key of ['fadeIn', 'fadeOut'] as const) {
    el.querySelector<HTMLInputElement>(`[data-fade="${key}"]`)!.value = String(layer[key])
    el.querySelector(`[data-fade-val="${key}"]`)!.textContent = `${layer[key].toFixed(1)}s`
  }
  for (const g of GRADES) {
    el.querySelector<HTMLInputElement>(`[data-grade="${g.key}"]`)!.value = String(layer.grade[g.key])
    el.querySelector(`[data-grade-val="${g.key}"]`)!.textContent = String(layer.grade[g.key])
  }
}

/** Repaints the backgrounds when nothing is animating; while playing, the next frame picks changes up. */
function refresh(): void {
  if (!state.isPlaying) renderBackgrounds()
}

function bindLayer(el: HTMLElement, i: number): void {
  const layer = bgLayers[i]
  const slot = el.querySelector<HTMLButtonElement>('.file-slot')!
  const input = el.querySelector<HTMLInputElement>('input[type="file"]')!

  const load = (file: File | undefined) => {
    if (!file) return
    const hadAudio = !!layer.audio
    if (!loadBackground(i, file, state.isPlaying, refresh)) {
      slot.textContent = `${file.name} is not a photo or video`
      return
    }
    layerFiles[i] = file
    syncLayer(el, layer)
    dirty()
    if (hadAudio) soundEdited()
    if (!file.type.startsWith('video/')) return
    // The video element stays muted: its sound is decoded and mixed into the track instead,
    // so it plays in step with the timeline and ends up in the export. A video without sound is fine.
    const url = layer.url
    decodeSound(file).then(audio => {
      if (layer.url !== url) return
      layer.audio = audio
      syncLayer(el, layer)
      soundEdited()
      // The loop length is the video's duration; remix once it's known.
      const video = layer.media
      if (video instanceof HTMLVideoElement && !video.duration) {
        video.addEventListener('loadedmetadata', () => { if (layer.url === url) soundEdited() }, { once: true })
      }
    }, () => { /* no sound track */ })
  }

  loaders[i] = load
  slot.addEventListener('click', () => input.click())
  input.addEventListener('change', () => { load(input.files?.[0]); input.value = '' })
  slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('is-dragging') })
  slot.addEventListener('dragleave', () => slot.classList.remove('is-dragging'))
  slot.addEventListener('drop', e => {
    e.preventDefault()
    slot.classList.remove('is-dragging')
    load(e.dataTransfer?.files[0])
  })

  el.querySelector('.bg-remove')!.addEventListener('click', () => {
    const hadAudio = !!layer.audio
    clearBackground(i)
    layerFiles[i] = null
    syncLayer(el, layer)
    refresh()
    dirty()
    if (hadAudio) soundEdited()
  })

  const volume = el.querySelector<HTMLInputElement>('[data-volume]')!
  volume.addEventListener('input', () => {
    layer.volume = Number(volume.value)
    el.querySelector('[data-volume-val]')!.textContent = volume.value
    soundEdited()
  })

  el.querySelectorAll<HTMLInputElement>('[data-fade]').forEach(slider => {
    slider.addEventListener('input', () => {
      const key = slider.dataset.fade as 'fadeIn' | 'fadeOut'
      layer[key] = Number(slider.value)
      el.querySelector(`[data-fade-val="${key}"]`)!.textContent = `${layer[key].toFixed(1)}s`
      soundEdited()
    })
  })

  const opacity = el.querySelector<HTMLInputElement>('[data-opacity]')!
  opacity.addEventListener('input', () => {
    layer.opacity = Number(opacity.value)
    el.querySelector('[data-opacity-val]')!.textContent = opacity.value
    refresh()
  })

  el.querySelectorAll<HTMLInputElement>('[data-grade]').forEach(slider => {
    slider.addEventListener('input', () => {
      const key = slider.dataset.grade as keyof BgLayer['grade']
      layer.grade[key] = Number(slider.value)
      el.querySelector(`[data-grade-val="${key}"]`)!.textContent = slider.value
      refresh()
    })
  })

  el.querySelector('[data-grade-reset]')!.addEventListener('click', () => {
    resetGrade(layer)
    syncLayer(el, layer)
    refresh()
  })

  const expand = el.querySelector<HTMLElement>('.fx-expand')!
  expand.addEventListener('click', () => {
    document.getElementById(expand.dataset.target!)?.classList.toggle('open')
    expand.classList.toggle('open')
  })
}

const blendBtns = () => document.querySelectorAll<HTMLButtonElement>('[data-blend]')

export function setBlend(blend: typeof bgSettings.blend): void {
  bgSettings.blend = blend
  applyBlend()
  blendBtns().forEach(b => b.classList.toggle('active', b.dataset.blend === blend))
}

/**
 * Called once a drawing is loaded. A drawing without any transparency would hide the
 * backgrounds, so it starts in screen mode, where its black shows them through.
 */
export function pickBlendForDrawing(): void {
  const data = mCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height).data
  let opaque = true
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) { opaque = false; break }
  }
  setBlend(opaque ? 'screen' : 'source-over')
}

export function initBackgrounds(): void {
  const container = document.getElementById('bgLayers')!
  container.innerHTML = bgLayers.map((_, i) => layerHtml(i)).join('')
  container.querySelectorAll<HTMLElement>('.bg-layer').forEach((el, i) => bindLayer(el, i))
  blendBtns().forEach(b => b.addEventListener('click', () => setBlend(b.dataset.blend as typeof bgSettings.blend)))
  setBlend(bgSettings.blend)
}
