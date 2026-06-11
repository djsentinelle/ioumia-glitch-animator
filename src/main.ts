import './style.css'

// Bypass TS module resolution for CDN dynamic imports (no @ts-ignore needed)
const importCdn = new Function('url', 'return import(url)') as (url: string) => Promise<Record<string, unknown>>

// ── Types ──────────────────────────────────────────────────────────

interface Particle {
  ox: number; oy: number
  x: number;  y: number
  r: number;  g: number; b: number; a: number
  phase: number
  speed: number
  size: number
  vx: number; vy: number
  life: number
  rainY: number | undefined
}

interface Settings {
  intensity: number
  speed: number
  size: number
  glitch: number
  sparkle: number
  density: number
  resolution: number
  [key: string]: number
}

interface Tint {
  r: number; g: number; b: number
  [key: string]: number
}

interface Cursor {
  x: number; y: number; active: boolean
}

interface CropBounds {
  x: number; y: number; w: number; h: number
}

interface ApplyResult {
  x: number; y: number; life: number; isRgb: boolean
}

interface FxSettings {
  sparkle: { radius: number; speed: number }
  drift:   { amp: number;    speed: number }
  pulse:   { scale: number;  speed: number }
  rain:    { speed: number;  opacity: number; trail: number; fade: number }
  explode: { force: number;  speed: number }
  rgb:     { spread: number; speed: number }
  blow:    { force: number;  radius: number; chaos: number }
  [key: string]: Record<string, number>
}

declare class GIF {
  constructor(options: { workers: number; quality: number; width: number; height: number; workerScript: string })
  addFrame(canvas: HTMLCanvasElement, options: { delay: number }): void
  render(): void
  on(event: 'finished', cb: (blob: Blob) => void): void
}

// ── DOM Elements ──────────────────────────────────────────────────

const renderPane    = document.getElementById('renderPane')    as HTMLDivElement
const zoomContainer = document.getElementById('zoomContainer') as HTMLDivElement
const zoomBar       = document.getElementById('zoomBar')       as HTMLDivElement
const zoomLabelEl   = document.getElementById('zoomLabel')     as HTMLSpanElement

const dropZone      = document.getElementById('dropZone')      as HTMLDivElement
const fileInput     = document.getElementById('fileInput')     as HTMLInputElement
const wrapper       = document.getElementById('canvasWrapper') as HTMLDivElement
const mainCanvas    = document.getElementById('mainCanvas')    as HTMLCanvasElement
const glitchCanvas  = document.getElementById('glitchCanvas') as HTMLCanvasElement
const mCtx          = mainCanvas.getContext('2d')!
const gCtx          = glitchCanvas.getContext('2d')!
const playBtn       = document.getElementById('playBtn')       as HTMLButtonElement
const resetBtn      = document.getElementById('resetBtn')      as HTMLButtonElement
const controls      = document.getElementById('controls')      as HTMLDivElement
const recBadge      = document.getElementById('recBadge')      as HTMLDivElement
const recBtn        = document.getElementById('recBtn')        as HTMLButtonElement
const dlBtn         = document.getElementById('dlBtn')         as HTMLButtonElement
const gifBtn        = document.getElementById('gifBtn')        as HTMLButtonElement
const dlGifBtn      = document.getElementById('dlGifBtn')      as HTMLButtonElement
const convertTipEl  = document.getElementById('convertTip')    as HTMLDivElement
const mirrorBtn     = document.getElementById('mirrorBtn')     as HTMLButtonElement
const pixelSortBtn  = document.getElementById('pixelSortBtn')  as HTMLButtonElement
const durInput      = document.getElementById('durInput')      as HTMLInputElement
const recTimer      = document.getElementById('recTimer')      as HTMLDivElement
const recTimeEl     = document.getElementById('recTime')       as HTMLSpanElement
const cinemaBtn     = document.getElementById('cinemaBtn')     as HTMLButtonElement
const cinemaHint    = document.getElementById('cinemaHint')    as HTMLDivElement

// ── State ─────────────────────────────────────────────────────────

let img: HTMLImageElement | null = null
let animId: number | null = null
let isPlaying = false
let particles: Particle[] = []
const activeModes = new Set<string>(['sparkle'])
let modeList: string[] = [...activeModes]  // cached — updated only when activeModes changes
let frame = 0

const settings: Settings = {
  intensity: 5, speed: 4, size: 2, glitch: 3, sparkle: 5, density: 5, resolution: 100,
}
const tint: Tint = { r: 0, g: 0, b: 0 }
const cursor: Cursor = { x: -9999, y: -9999, active: false }

let mirrorActive    = false
let pixelSortActive = false

// ── FX per-effect settings ────────────────────────────────────────

const fx: FxSettings = {
  sparkle: { radius: 5,  speed: 4 },
  drift:   { amp: 4,     speed: 4 },
  pulse:   { scale: 8,   speed: 4 },
  rain:    { speed: 4,   opacity: 5, trail: 8, fade: 5 },
  explode: { force: 8,   speed: 4 },
  rgb:     { spread: 3,  speed: 4 },
  blow:    { force: 10,  radius: 80, chaos: 0 },
}

// ── Recording state ───────────────────────────────────────────────

let mediaRecorder: MediaRecorder | null = null
let recordedChunks: BlobPart[] = []
let recStartTime: number | null = null
let recTimerInterval: ReturnType<typeof setInterval> | null = null
let lastBlobUrl: string | null = null

const recCanvas = document.createElement('canvas')
const recCtx    = recCanvas.getContext('2d')!

let cropBounds: CropBounds | null = null
let gifRecording = false
let gifFrames: string[] = []
let gifInterval: ReturnType<typeof setInterval> | null = null
let gifAutoStop: ReturnType<typeof setTimeout> | null = null

// ── Shared result — avoids per-particle heap allocation ───────────

const _ar: ApplyResult = { x: 0, y: 0, life: 1, isRgb: false }
let _pixelSortTick = 0
let lastTap = 0

// ── Zoom ──────────────────────────────────────────────────────────

let zoomLevel = 1

function setZoom(z: number): void {
  zoomLevel = Math.min(4, Math.max(0.25, z))
  zoomContainer.style.transform = `scale(${zoomLevel})`
  zoomLabelEl.textContent = Math.round(zoomLevel * 100) + '%'
  const naturalW = zoomContainer.scrollWidth / zoomLevel
  const naturalH = zoomContainer.scrollHeight / zoomLevel
  zoomContainer.style.marginBottom = (naturalH * (zoomLevel - 1)) + 'px'
  zoomContainer.style.marginRight  = (naturalW * (zoomLevel - 1) / 2) + 'px'
}

document.getElementById('zoomIn')!.addEventListener('click',    () => setZoom(zoomLevel + 0.25))
document.getElementById('zoomOut')!.addEventListener('click',   () => setZoom(zoomLevel - 0.25))
document.getElementById('zoomReset')!.addEventListener('click', () => setZoom(1))

renderPane.addEventListener('wheel', e => {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  setZoom(zoomLevel - e.deltaY * 0.002)
}, { passive: false })

// ── Resolution ────────────────────────────────────────────────────

function applyResolution(): void {
  if (!img) return
  const factor = settings.resolution / 100
  mainCanvas.width    = Math.max(1, Math.round(img.naturalWidth  * factor))
  mainCanvas.height   = Math.max(1, Math.round(img.naturalHeight * factor))
  glitchCanvas.width  = mainCanvas.width
  glitchCanvas.height = mainCanvas.height
  mCtx.drawImage(img, 0, 0, mainCanvas.width, mainCanvas.height)
  buildParticles()
}

;(document.getElementById('resolutionSlider') as HTMLInputElement).addEventListener('input', function () {
  settings.resolution = parseInt(this.value)
  document.getElementById('resolutionVal')!.textContent = this.value + '%'
  applyResolution()
})

// ── Mirror / Pixel Sort ───────────────────────────────────────────

mirrorBtn.addEventListener('click', () => {
  mirrorActive = !mirrorActive
  mirrorBtn.classList.toggle('active', mirrorActive)
})

pixelSortBtn.addEventListener('click', () => {
  pixelSortActive = !pixelSortActive
  pixelSortBtn.classList.toggle('active', pixelSortActive)
})

// ── Clear all effects ─────────────────────────────────────────────

document.getElementById('clearFxBtn')!.addEventListener('click', () => {
  activeModes.clear()
  modeList = []
  particles.forEach(p => { p.vx = 0; p.vy = 0; p.x = p.ox; p.y = p.oy })
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'))
  mirrorActive = false
  pixelSortActive = false
  mirrorBtn.classList.remove('active')
  pixelSortBtn.classList.remove('active')
  tint.r = 0; tint.g = 0; tint.b = 0
  ;(document.getElementById('rSlider') as HTMLInputElement).value = '0'
  ;(document.getElementById('gSlider') as HTMLInputElement).value = '0'
  ;(document.getElementById('bSlider') as HTMLInputElement).value = '0'
  document.getElementById('rVal')!.textContent = '0'
  document.getElementById('gVal')!.textContent = '0'
  document.getElementById('bVal')!.textContent = '0'
  settings.glitch = 0
  ;(document.getElementById('glitchSlider') as HTMLInputElement).value = '0'
  document.getElementById('glitchVal')!.textContent = '0'
})

// ── Bounding box of non-black pixels ─────────────────────────────

function getDrawingBounds(sourceCanvas: HTMLCanvasElement): CropBounds {
  const ctx = sourceCanvas.getContext('2d')!
  const w = sourceCanvas.width, h = sourceCanvas.height
  const data = ctx.getImageData(0, 0, w, h).data
  let minX = w, minY = h, maxX = 0, maxY = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const brightness = (data[i] + data[i+1] + data[i+2]) / 3
      if (data[i+3] > 10 && brightness > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  const pad = 20
  return {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    w: Math.min(w, maxX - minX + pad * 2),
    h: Math.min(h, maxY - minY + pad * 2),
  }
}

// ── Recording ─────────────────────────────────────────────────────

recBtn.addEventListener('click', () => {
  if (recBtn.dataset.rendering) return
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopLiveRecording()
  } else {
    startRecording()
  }
})

async function startRecording(): Promise<void> {
  if (!img) return
  dlBtn.style.display = 'none'
  convertTipEl.style.display = 'none'
  if (lastBlobUrl) { URL.revokeObjectURL(lastBlobUrl); lastBlobUrl = null }
  cropBounds = getDrawingBounds(mainCanvas)
  recCanvas.width  = cropBounds.w
  recCanvas.height = cropBounds.h

  if (typeof VideoEncoder !== 'undefined') {
    await startOfflineRecording()
    return
  }

  // Fallback: live captureStream (Firefox / older browsers)
  recordedChunks = []
  const mimeType =
    MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2') ? 'video/mp4;codecs=avc1,mp4a.40.2' :
    MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')           ? 'video/mp4;codecs=avc1'           :
    MediaRecorder.isTypeSupported('video/mp4')                       ? 'video/mp4'                       :
    MediaRecorder.isTypeSupported('video/webm;codecs=vp9')           ? 'video/webm;codecs=vp9'           :
    MediaRecorder.isTypeSupported('video/webm;codecs=vp8')           ? 'video/webm;codecs=vp8'           :
    'video/webm'
  const fileExt = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'

  const stream = recCanvas.captureStream(60)
  mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 20_000_000 })

  mediaRecorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data)
  }

  mediaRecorder.onstop = () => {
    if (recTimerInterval) { clearInterval(recTimerInterval); recTimerInterval = null }
    recTimer.classList.remove('show')
    recBtn.classList.remove('recording')
    recBtn.innerHTML = '⏺ &nbsp;VIDEO'
    const videoBlob = new Blob(recordedChunks, { type: mimeType })
    lastBlobUrl = URL.createObjectURL(videoBlob)
    dlBtn.dataset.url = lastBlobUrl
    dlBtn.dataset.ext = fileExt
    dlBtn.innerHTML = fileExt === 'mp4' ? '⬇ &nbsp;DOWNLOAD MP4' : '⬇ &nbsp;DOWNLOAD WEBM'
    dlBtn.style.display = ''
    if (fileExt !== 'mp4') convertTipEl.style.display = ''
  }

  mediaRecorder.start(100)
  recStartTime = Date.now()
  recBtn.classList.add('recording')
  recBtn.innerHTML = '■ &nbsp;STOP'
  recTimer.classList.add('show')

  const durSecs = parseFloat(durInput.value)
  if (!isNaN(durSecs) && durSecs > 0) {
    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') stopLiveRecording()
    }, durSecs * 1000)
  }

  recTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - (recStartTime ?? Date.now())) / 1000)
    const m = Math.floor(elapsed / 60)
    const s = elapsed % 60
    recTimeEl.textContent = m + ':' + s.toString().padStart(2, '0')
  }, 500)

  compositeLoop()
}

function compositeLoop(): void {
  if (!mediaRecorder || mediaRecorder.state !== 'recording' || !cropBounds) return
  const { x, y, w, h } = cropBounds
  recCtx.clearRect(0, 0, w, h)
  recCtx.drawImage(mainCanvas, x, y, w, h, 0, 0, w, h)
  recCtx.globalCompositeOperation = 'screen'
  recCtx.drawImage(glitchCanvas, x, y, w, h, 0, 0, w, h)
  recCtx.globalCompositeOperation = 'source-over'
  requestAnimationFrame(compositeLoop)
}

function stopLiveRecording(): void {
  if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop()
}

// ── Offline WebCodecs renderer ────────────────────────────────────

async function startOfflineRecording(): Promise<void> {
  const fps = 60
  const durationSecs = Math.max(1, parseFloat(durInput.value) || 10)
  const totalFrames = Math.round(durationSecs * fps)
  if (!cropBounds) return
  const { x: ox, y: oy, w: cw, h: ch } = cropBounds

  recBtn.dataset.rendering = '1'
  recBtn.classList.add('recording')
  recBtn.innerHTML = '⏳ &nbsp;0%'
  recBadge.classList.add('show')
  stopAnim()

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let MuxerCls: any, ArrBufCls: any, muxerOpts: any, encoderCodec: string, fileType: string, fileExt: string

    const avcCheck = await VideoEncoder.isConfigSupported({
      codec: 'avc1.640028', width: cw, height: ch, bitrate: 20_000_000,
    })

    if (avcCheck.supported) {
      const m = await importCdn('https://unpkg.com/mp4-muxer/build/mp4-muxer.mjs')
      MuxerCls = m['Muxer']; ArrBufCls = m['ArrayBufferTarget']
      muxerOpts = { video: { codec: 'avc', width: cw, height: ch, frameRate: fps }, fastStart: 'in-memory' }
      encoderCodec = 'avc1.640028'; fileType = 'video/mp4'; fileExt = 'mp4'
    } else {
      const m = await importCdn('https://unpkg.com/webm-muxer/build/webm-muxer.mjs')
      MuxerCls = m['Muxer']; ArrBufCls = m['ArrayBufferTarget']
      muxerOpts = { video: { codec: 'V_VP9', width: cw, height: ch, frameRate: fps } }
      encoderCodec = 'vp09.00.10.08'; fileType = 'video/webm'; fileExt = 'webm'
    }

    const target = new ArrBufCls()
    const muxer  = new MuxerCls({ target, ...muxerOpts })

    const encoder = new VideoEncoder({
      output: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => muxer.addVideoChunk(chunk, meta),
      error:  (e: Error) => console.error('VideoEncoder:', e),
    })
    encoder.configure({ codec: encoderCodec, width: cw, height: ch, bitrate: 20_000_000, framerate: fps })

    buildParticles()
    const savedFrame = frame
    frame = 0; _pixelSortTick = 0

    for (let f = 0; f < totalFrames; f++) {
      frame = f + 1
      renderSingleFrame()

      recCtx.clearRect(0, 0, cw, ch)
      recCtx.drawImage(mainCanvas, ox, oy, cw, ch, 0, 0, cw, ch)
      recCtx.globalCompositeOperation = 'screen'
      recCtx.drawImage(glitchCanvas, ox, oy, cw, ch, 0, 0, cw, ch)
      recCtx.globalCompositeOperation = 'source-over'

      const vf = new VideoFrame(recCanvas, {
        timestamp: Math.round(f * 1_000_000 / fps),
        duration:  Math.round(1_000_000 / fps),
      })
      encoder.encode(vf, { keyFrame: f % (fps * 2) === 0 })
      vf.close()

      if (f % 20 === 0) {
        recBtn.innerHTML = '⏳ &nbsp;' + Math.round(f / totalFrames * 100) + '%'
        await new Promise<void>(r => setTimeout(r, 0))
      }
    }

    await encoder.flush()
    muxer.finalize()

    const blob = new Blob([target.buffer], { type: fileType })
    lastBlobUrl = URL.createObjectURL(blob)
    dlBtn.dataset.url = lastBlobUrl
    dlBtn.dataset.ext = fileExt
    dlBtn.innerHTML = '⬇ &nbsp;DOWNLOAD ' + fileExt.toUpperCase()
    dlBtn.style.display = ''
    if (fileExt !== 'mp4') convertTipEl.style.display = ''

    frame = savedFrame
    startAnim()

  } catch (err) {
    console.error('Offline render failed:', err)
  }

  recBtn.innerHTML = '⏺ &nbsp;RECORD VIDEO'
  recBtn.classList.remove('recording')
  recBadge.classList.remove('show')
  delete recBtn.dataset.rendering
}

dlBtn.addEventListener('click', () => {
  if (!dlBtn.dataset.url) return
  const a = document.createElement('a')
  a.href = dlBtn.dataset.url
  a.download = 'glitch-animation.' + (dlBtn.dataset.ext ?? 'mp4')
  a.click()
})

// ── Cinema mode ───────────────────────────────────────────────────

cinemaBtn.addEventListener('click', () => {
  if (!isPlaying) startAnim()
  document.body.classList.add('cinema-mode')
  cinemaHint.style.animation = 'none'
  void cinemaHint.offsetWidth
  cinemaHint.style.animation = 'fadeHint 3s ease forwards'
})

document.addEventListener('touchend', () => {
  if (!document.body.classList.contains('cinema-mode')) return
  const now = Date.now()
  if (now - lastTap < 350) document.body.classList.remove('cinema-mode')
  lastTap = now
})

document.addEventListener('dblclick', () => {
  if (document.body.classList.contains('cinema-mode')) document.body.classList.remove('cinema-mode')
})

// ── Blow: cursor tracking ─────────────────────────────────────────

function getCursorPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width  / rect.width
  const scaleY = canvas.height / rect.height
  const src = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : (e as MouseEvent)
  return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY }
}

wrapper.addEventListener('mousemove', e => {
  const pos = getCursorPos(e, mainCanvas)
  cursor.x = pos.x; cursor.y = pos.y; cursor.active = true
})
wrapper.addEventListener('mouseleave', () => {
  cursor.x = -9999; cursor.y = -9999; cursor.active = false
})
wrapper.addEventListener('touchmove', e => {
  if (!activeModes.has('blow')) return
  e.preventDefault()
  const pos = getCursorPos(e, mainCanvas)
  cursor.x = pos.x; cursor.y = pos.y; cursor.active = true
}, { passive: false })
wrapper.addEventListener('touchend', () => {
  cursor.x = -9999; cursor.y = -9999; cursor.active = false
})

// ── GIF recording ─────────────────────────────────────────────────

gifBtn.addEventListener('click', () => {
  if (gifRecording) stopGif(); else startGif()
})

function startGif(): void {
  if (!img) return
  if (!isPlaying) startAnim()
  if (!cropBounds) cropBounds = getDrawingBounds(mainCanvas)
  gifRecording = true
  gifFrames = []
  dlGifBtn.style.display = 'none'
  gifBtn.classList.add('recording')
  gifBtn.innerHTML = '■ &nbsp;STOP GIF'
  recTimer.classList.add('show')

  gifInterval = setInterval(() => {
    const cb = cropBounds ?? { x: 0, y: 0, w: mainCanvas.width, h: mainCanvas.height }
    const gc = document.createElement('canvas')
    gc.width  = cb.w
    gc.height = cb.h
    const gx = gc.getContext('2d')!
    gx.drawImage(mainCanvas, cb.x, cb.y, cb.w, cb.h, 0, 0, cb.w, cb.h)
    gx.globalCompositeOperation = 'screen'
    gx.drawImage(glitchCanvas, cb.x, cb.y, cb.w, cb.h, 0, 0, cb.w, cb.h)
    gifFrames.push(gc.toDataURL('image/png'))
  }, 33)

  const durSecs = parseFloat(durInput.value)
  if (!isNaN(durSecs) && durSecs > 0) gifAutoStop = setTimeout(stopGif, durSecs * 1000)
}

function stopGif(): void {
  if (gifInterval)  { clearInterval(gifInterval);   gifInterval  = null }
  if (gifAutoStop)  { clearTimeout(gifAutoStop);    gifAutoStop  = null }
  gifRecording = false
  gifBtn.classList.remove('recording')
  gifBtn.innerHTML = '⏺ &nbsp;GIF'
  recTimer.classList.remove('show')
  if (gifFrames.length === 0) return
  buildGif(gifFrames)
}

function buildGif(frames: string[]): void {
  gifBtn.innerHTML = '⏳ Building GIF...'
  gifBtn.disabled = true

  const script = document.createElement('script')
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js'
  script.onerror = () => {
    console.error('Failed to load gif.js')
    gifBtn.innerHTML = '⏺ &nbsp;GIF'
    gifBtn.disabled = false
  }
  script.onload = () => {
    const cb = cropBounds ?? { w: mainCanvas.width, h: mainCanvas.height }
    const gif = new GIF({
      workers: 2, quality: 1, width: cb.w, height: cb.h,
      workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
    })
    let loaded = 0
    frames.forEach(src => {
      const frameImg = new Image()
      frameImg.onload = () => {
        const fc = document.createElement('canvas')
        fc.width = mainCanvas.width; fc.height = mainCanvas.height
        fc.getContext('2d')!.drawImage(frameImg, 0, 0)
        gif.addFrame(fc, { delay: 33 })
        loaded++
        if (loaded === frames.length) gif.render()
      }
      frameImg.src = src
    })
    gif.on('finished', blob => {
      const url = URL.createObjectURL(blob)
      dlGifBtn.dataset.url = url
      dlGifBtn.style.display = ''
      gifBtn.innerHTML = '⏺ &nbsp;GIF'
      gifBtn.disabled = false
    })
  }
  document.head.appendChild(script)
}

dlGifBtn.addEventListener('click', () => {
  if (!dlGifBtn.dataset.url) return
  const a = document.createElement('a')
  a.href = dlGifBtn.dataset.url
  a.download = 'glitch-animation.gif'
  a.click()
})

// ── Load image ────────────────────────────────────────────────────

dropZone.addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', e => {
  const files = (e.target as HTMLInputElement).files
  if (files?.[0]) loadFile(files[0])
})
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = '#00ffb4' })
dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '' })
dropZone.addEventListener('drop', e => {
  e.preventDefault()
  dropZone.style.borderColor = ''
  const file = e.dataTransfer?.files[0]
  if (file) loadFile(file)
})

function loadFile(file: File): void {
  if (!file.type.startsWith('image/')) return
  const url = URL.createObjectURL(file)
  img = new Image()
  img.onload = () => {
    settings.resolution = 100
    ;(document.getElementById('resolutionSlider') as HTMLInputElement).value = '100'
    document.getElementById('resolutionVal')!.textContent = '100%'
    applyResolution()
    dropZone.style.display = 'none'
    wrapper.classList.add('visible')
    controls.style.display = 'flex'
    controls.style.flexDirection = 'column'
    zoomBar.classList.add('visible')
    requestAnimationFrame(() => {
      const paneW = renderPane.clientWidth  - 48
      const paneH = renderPane.clientHeight - 48
      const displayW = wrapper.clientWidth
      const displayH = displayW * (img!.naturalHeight / img!.naturalWidth)
      const fit = Math.min(paneW / displayW, paneH / displayH, 1)
      setZoom(fit)
    })
  }
  img.src = url
}

// ── Build particles from bright pixels ────────────────────────────

function buildParticles(): void {
  particles = []
  const w = mainCanvas.width, h = mainCanvas.height
  const data = mCtx.getImageData(0, 0, w, h).data
  const step = Math.max(1, Math.ceil(12 / settings.density))

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4
      const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3]
      const maxChannel = Math.max(r, g, b)
      if (a > 30 && maxChannel > 12) {
        const boost   = Math.min(255, Math.round(r * 2.5))
        const gboost  = Math.min(255, Math.round(g * 2.5))
        const bboost  = Math.min(255, Math.round(b * 2.5))
        const weightedA = Math.min(255, Math.round((maxChannel / 255) * 255 * 2))
        particles.push({
          ox: x, oy: y, x, y,
          r: boost, g: gboost, b: bboost, a: weightedA,
          phase: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random() * 1.5,
          size:  0.5 + Math.random() * 1.5,
          vx: 0, vy: 0,
          life: 1,
          rainY: undefined,
        })
      }
    }
  }
}

// ── Sliders ───────────────────────────────────────────────────────

function bindSlider(id: string, valId: string, key: string): void {
  const slider = document.getElementById(id) as HTMLInputElement
  const valEl  = document.getElementById(valId)!
  slider.addEventListener('input', () => {
    settings[key] = parseInt(slider.value)
    valEl.textContent = slider.value
    if (key === 'intensity' || key === 'size' || key === 'density') buildParticles()
  })
}
bindSlider('sizeSlider',    'sizeVal',    'size')
bindSlider('glitchSlider',  'glitchVal',  'glitch')
bindSlider('densitySlider', 'densityVal', 'density')

function bindFxSlider(id: string, valId: string, effect: string, key: string): void {
  const el  = document.getElementById(id) as HTMLInputElement | null
  const val = document.getElementById(valId)
  if (!el || !val) return
  el.addEventListener('input', () => {
    fx[effect][key] = parseFloat(el.value)
    val.textContent = el.value
    if (key === 'density') buildParticles()
  })
}
bindFxSlider('sparkleSlider',      'sparkleVal',      'sparkle', 'radius')
bindFxSlider('sparkleSpeedSlider', 'sparkleSpeedVal', 'sparkle', 'speed')
bindFxSlider('driftAmpSlider',     'driftAmpVal',     'drift',   'amp')
bindFxSlider('driftSpeedSlider',   'driftSpeedVal',   'drift',   'speed')
bindFxSlider('pulseScaleSlider',   'pulseScaleVal',   'pulse',   'scale')
bindFxSlider('pulseSpeedSlider',   'pulseSpeedVal',   'pulse',   'speed')
bindFxSlider('rainSpeedSlider',    'rainSpeedVal',    'rain',    'speed')
bindFxSlider('rainOpacitySlider',  'rainOpacityVal',  'rain',    'opacity')
bindFxSlider('rainTrailSlider',    'rainTrailVal',    'rain',    'trail')
bindFxSlider('rainFadeSlider',     'rainFadeVal',     'rain',    'fade')
bindFxSlider('explodeForceSlider', 'explodeForceVal', 'explode', 'force')
bindFxSlider('explodeSpeedSlider', 'explodeSpeedVal', 'explode', 'speed')
bindFxSlider('rgbSpreadSlider',    'rgbSpreadVal',    'rgb',     'spread')
bindFxSlider('rgbSpeedSlider',     'rgbSpeedVal',     'rgb',     'speed')
bindFxSlider('blowForceSlider',    'blowForceVal',    'blow',    'force')
bindFxSlider('blowRadiusSlider',   'blowRadiusVal',   'blow',    'radius')
bindFxSlider('blowChaosSlider',    'blowChaosVal',    'blow',    'chaos')

// ── Expand/collapse param panels ──────────────────────────────────

document.querySelectorAll('.fx-expand').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = (btn as HTMLElement).dataset.target
    if (!target) return
    document.getElementById(target)?.classList.toggle('open')
    btn.classList.toggle('open')
  })
})

// ── RGB tint sliders ──────────────────────────────────────────────

;(['r', 'g', 'b'] as const).forEach(ch => {
  const slider = document.getElementById(ch + 'Slider') as HTMLInputElement
  const valEl  = document.getElementById(ch + 'Val')!
  slider.addEventListener('input', () => {
    tint[ch] = parseInt(slider.value)
    valEl.textContent = slider.value
  })
})

// ── Mode buttons ──────────────────────────────────────────────────

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const m = (btn as HTMLElement).dataset.mode
    if (!m) return
    if (activeModes.has(m)) {
      activeModes.delete(m)
      btn.classList.remove('active')
    } else {
      activeModes.add(m)
      btn.classList.add('active')
    }
    modeList = [...activeModes]  // invalidate cache
    buildParticles()
  })
})

// ── Play / Stop ───────────────────────────────────────────────────

playBtn.addEventListener('click', () => { if (isPlaying) stopAnim(); else startAnim() })

resetBtn.addEventListener('click', () => {
  stopAnim()
  dropZone.style.display = ''
  wrapper.classList.remove('visible')
  controls.style.display = 'none'
  zoomBar.classList.remove('visible')
  setZoom(1)
  img = null
  particles = []
  fileInput.value = ''
})

function startAnim(): void {
  isPlaying = true
  playBtn.textContent = '■  STOP'
  playBtn.classList.add('active')
  recBadge.classList.add('show')
  buildParticles()
  loop()
}

function stopAnim(): void {
  isPlaying = false
  if (animId !== null) cancelAnimationFrame(animId)
  playBtn.textContent = '▶  PLAY'
  playBtn.classList.remove('active')
  recBadge.classList.remove('show')
  if (img) {
    mCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height)
    mCtx.drawImage(img, 0, 0, mainCanvas.width, mainCanvas.height)
    gCtx.clearRect(0, 0, glitchCanvas.width, glitchCanvas.height)
  }
}

// ── Apply single effect mode ──────────────────────────────────────

function applyMode(m: string, p: Particle, t: number): ApplyResult {
  const w = mainCanvas.width, h = mainCanvas.height
  _ar.x = p.x; _ar.y = p.y; _ar.life = p.life; _ar.isRgb = false

  if (m === 'sparkle') {
    const sparkleRadius = fx.sparkle.radius * 0.6
    const spd2 = fx.sparkle.speed / 4
    _ar.x    = p.ox + (Math.random() - 0.5) * sparkleRadius
    _ar.y    = p.oy + (Math.random() - 0.5) * sparkleRadius
    _ar.life = 0.3 + 0.7 * Math.abs(Math.sin(frame * spd2 * p.speed * 0.05 + p.phase))

  } else if (m === 'drift') {
    const dSpd = fx.drift.speed / 4
    const dAmp = fx.drift.amp
    const dt = frame * dSpd * p.speed * 0.02 + p.phase
    _ar.x    = p.ox + Math.sin(dt) * dAmp
    _ar.y    = p.oy + Math.cos(dt * 0.7) * dAmp * 0.75
    _ar.life = 0.5 + 0.5 * Math.sin(dt)

  } else if (m === 'pulse') {
    const pSpd   = fx.pulse.speed / 4
    const pScale = fx.pulse.scale / 100
    const pt     = frame * pSpd * 0.01
    const scale  = 1 + Math.sin(pt * 0.5) * pScale
    _ar.x    = p.ox * scale + (w * (1 - scale)) / 2
    _ar.y    = p.oy * scale + (h * (1 - scale)) / 2
    _ar.life = 0.4 + 0.6 * Math.abs(Math.sin(pt))

  } else if (m === 'rain') {
    if (p.rainY === undefined) p.rainY = p.oy + Math.random() * (h - p.oy)
    const rainSpd     = fx.rain.speed / 4
    const rainOpacity = fx.rain.opacity / 10
    p.rainY += rainSpd * 1.5 * p.speed
    if (p.rainY > h + 10) p.rainY = p.oy
    _ar.x = p.ox + (Math.random() - 0.5) * 0.8
    _ar.y = p.rainY
    const distFromOrigin = Math.max(0, p.rainY - p.oy) / (h - p.oy + 1)
    _ar.life = Math.max(0.05, (1 - distFromOrigin) * rainOpacity * 1.8)

  } else if (m === 'explode') {
    const cx = w / 2, cy = h / 2
    const dx = p.ox - cx, dy = p.oy - cy
    const et    = (frame * fx.explode.speed * 0.003) % 1
    const scale = 1 + et * fx.explode.force * 0.4
    _ar.x    = cx + dx * scale
    _ar.y    = cy + dy * scale
    _ar.life = Math.max(0, 1 - et * 1.4)

  } else if (m === 'rgb') {
    const rSpd = fx.rgb.speed / 4
    const rt   = frame * rSpd * p.speed * 0.02
    _ar.x      = p.ox + Math.sin(rt * 1.5) * fx.rgb.spread
    _ar.y      = p.oy
    _ar.life   = 0.6 + 0.4 * Math.abs(Math.sin(rt * 3))
    _ar.isRgb  = true

  } else if (m === 'blow') {
    const blowForce = fx.blow.force / 10
    const dx = p.ox - cursor.x, dy = p.oy - cursor.y
    const distSq   = dx * dx + dy * dy
    const chaosAmt = fx.blow.chaos / 10
    const noise    = Math.sin(p.phase * 13.7) * 0.6 + Math.sin(p.phase * 7.3) * 0.4
    const blowRadius = fx.blow.radius * (1 + chaosAmt * noise * 2)
    if (distSq < blowRadius * blowRadius && distSq > 0) {
      const dist  = Math.sqrt(distSq)
      const force = (1 - dist / blowRadius) * blowRadius * 0.5 * blowForce
      p.vx += (dx / dist) * force * 0.15
      p.vy += (dy / dist) * force * 0.15
    }
    p.vx += (p.ox - p.x) * 0.08
    p.vy += (p.oy - p.y) * 0.08
    p.vx *= 0.75
    p.vy *= 0.75
    _ar.x = p.x + p.vx
    _ar.y = p.y + p.vy
    p.x = _ar.x; p.y = _ar.y
    _ar.life = 0.6 + 0.4 * Math.abs(Math.sin(t * 2 + p.phase))
  }

  return _ar
}

// ── Core render ───────────────────────────────────────────────────

function renderSingleFrame(): void {
  const w = mainCanvas.width, h = mainCanvas.height
  const spd      = settings.speed / 4
  const glitchAmt = settings.glitch

  mCtx.clearRect(0, 0, w, h)
  mCtx.globalAlpha = 1
  mCtx.drawImage(img!, 0, 0, w, h)

  // RGB Color Overlay (screen blend — skips black, preserves white)
  if (tint.r !== 0 || tint.g !== 0 || tint.b !== 0) {
    const cr = Math.round(255 + tint.r)
    const cg = Math.round(255 + tint.g)
    const cb = Math.round(255 + tint.b)
    const strength = Math.max(255 - cr, 255 - cg, 255 - cb) / 255
    mCtx.save()
    mCtx.globalCompositeOperation = 'multiply'
    mCtx.globalAlpha = strength * 0.85
    mCtx.fillStyle = `rgb(${cr},${cg},${cb})`
    mCtx.fillRect(0, 0, w, h)
    mCtx.restore()
  }

  // Mirror
  if (mirrorActive) {
    mCtx.save()
    mCtx.translate(w, 0)
    mCtx.scale(-1, 1)
    mCtx.drawImage(mainCanvas, 0, 0, w / 2, h, 0, 0, w / 2, h)
    mCtx.restore()
  }

  // Pixel Sort
  _pixelSortTick++
  if (pixelSortActive && _pixelSortTick % 3 === 0) {
    const imgData  = mCtx.getImageData(0, 0, w, h)
    const d        = imgData.data
    const numRows  = Math.floor(h * 0.15)
    const threshold = 6
    for (let s = 0; s < numRows; s++) {
      const row  = Math.floor(Math.random() * h)
      const base = row * w * 4
      let segStart = -1
      const flush = (end: number) => {
        if (segStart < 0 || end - segStart < 3) return
        const pixels: Array<{ r: number; g: number; b: number; a: number; lum: number }> = []
        for (let x = segStart; x < end; x++) {
          const i = base + x * 4
          pixels.push({ r: d[i], g: d[i+1], b: d[i+2], a: d[i+3],
                        lum: 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2] })
        }
        pixels.sort((a, b) => a.lum - b.lum)
        for (let x = segStart; x < end; x++) {
          const i  = base + x * 4
          const px = pixels[x - segStart]
          d[i] = px.r; d[i+1] = px.g; d[i+2] = px.b; d[i+3] = px.a
        }
        segStart = -1
      }
      for (let x = 0; x < w; x++) {
        const i      = base + x * 4
        const bright = (d[i] + d[i+1] + d[i+2]) / 3
        if (bright > threshold) {
          if (segStart < 0) segStart = x
        } else {
          flush(x)
        }
      }
      flush(w)
    }
    mCtx.putImageData(imgData, 0, 0)
  }

  // Glitch horizontal slices
  if (glitchAmt > 0 && frame % Math.max(1, Math.floor(8 - glitchAmt)) === 0) {
    const numSlices = Math.floor(glitchAmt * 0.8)
    for (let s = 0; s < numSlices; s++) {
      const sy     = Math.random() * h
      const sh     = 2 + Math.random() * (glitchAmt * 3)
      const offset = (Math.random() - 0.5) * glitchAmt * 8
      mCtx.drawImage(img!, 0, sy, w, sh, offset, sy, w, sh)
      if (Math.random() < 0.4) {
        mCtx.globalAlpha = 0.3
        mCtx.globalCompositeOperation = 'screen'
        mCtx.drawImage(img!, 0, sy, w, sh, offset + 3, sy, w, sh)
        mCtx.drawImage(img!, 0, sy, w, sh, offset - 3, sy, w, sh)
        mCtx.globalCompositeOperation = 'source-over'
        mCtx.globalAlpha = 1
      }
    }
  }

  // Draw particles
  gCtx.clearRect(0, 0, w, h)
  const stride = particles.length > 20000 ? Math.ceil(particles.length / 20000) : 1
  const pSize  = settings.size * 0.8

  let _lastStyle = ''
  let _lastAlpha = -1

  for (const m of modeList) {
    for (let _pi = 0; _pi < particles.length; _pi += stride) {
      const p = particles[_pi]
      const t = frame * spd * p.speed + p.phase
      const { x, y, life, isRgb } = applyMode(m, p, t)

      const alpha = Math.min(1, life * (p.a / 255) * (modeList.length > 1 ? 0.75 : 1))
      if (alpha < 0.05) continue

      if (isRgb) {
        const rOff = fx.rgb.spread * 0.7
        if (alpha !== _lastAlpha) { gCtx.globalAlpha = alpha; _lastAlpha = alpha }
        const s1 = `rgb(255,${p.g},${p.b})`
        if (s1 !== _lastStyle) { gCtx.fillStyle = s1; _lastStyle = s1 }
        gCtx.fillRect(x - rOff, p.oy, pSize, pSize)
        const s2 = `rgb(${p.r},255,${p.b})`
        if (s2 !== _lastStyle) { gCtx.fillStyle = s2; _lastStyle = s2 }
        gCtx.fillRect(x, p.oy, pSize, pSize)
        const s3 = `rgb(${p.r},${p.g},255)`
        if (s3 !== _lastStyle) { gCtx.fillStyle = s3; _lastStyle = s3 }
        gCtx.fillRect(x + rOff, p.oy, pSize, pSize)
      } else {
        const pBright = (p.r + p.g + p.b) / 3
        let pr = p.r, pg = p.g, pb = p.b
        if (pBright <= 200 && (tint.r !== 0 || tint.g !== 0 || tint.b !== 0)) {
          const strength = Math.min(1, Math.max(Math.abs(tint.r), Math.abs(tint.g), Math.abs(tint.b)) / 255)
          const tr = tint.r >= 0 ? 255 - (255 - p.r) * (255 - tint.r) / 255 : p.r * (255 + tint.r) / 255
          const tg = tint.g >= 0 ? 255 - (255 - p.g) * (255 - tint.g) / 255 : p.g * (255 + tint.g) / 255
          const tb = tint.b >= 0 ? 255 - (255 - p.b) * (255 - tint.b) / 255 : p.b * (255 + tint.b) / 255
          pr = Math.max(0, Math.min(255, Math.round(p.r + (tr - p.r) * strength)))
          pg = Math.max(0, Math.min(255, Math.round(p.g + (tg - p.g) * strength)))
          pb = Math.max(0, Math.min(255, Math.round(p.b + (tb - p.b) * strength)))
        }
        const style     = `rgb(${pr},${pg},${pb})`
        const glowAlpha = alpha * 0.25
        if (glowAlpha !== _lastAlpha) { gCtx.globalAlpha = glowAlpha; _lastAlpha = glowAlpha }
        if (style !== _lastStyle)     { gCtx.fillStyle = style;       _lastStyle = style }
        gCtx.fillRect(x - 1, y - 1, pSize + 2, pSize + 2)
        if (alpha !== _lastAlpha) { gCtx.globalAlpha = alpha; _lastAlpha = alpha }
        gCtx.fillRect(x, y, pSize, pSize)

        // Rain shooting-star trail
        if (m === 'rain' && fx.rain.trail > 0) {
          const trailLen = fx.rain.trail * 6
          const fadeMid  = Math.max(0.02, 1 - fx.rain.fade / 11)
          const cx       = x + pSize / 2
          const grad     = gCtx.createLinearGradient(cx, y, cx, y - trailLen)
          grad.addColorStop(0,       `rgba(${pr},${pg},${pb},${alpha})`)
          grad.addColorStop(fadeMid, `rgba(${pr},${pg},${pb},${(alpha * 0.15).toFixed(3)})`)
          grad.addColorStop(1,       `rgba(${pr},${pg},${pb},0)`)
          const prevLineW    = gCtx.lineWidth
          gCtx.globalAlpha  = 1; _lastAlpha = 1
          gCtx.strokeStyle  = grad
          gCtx.lineWidth    = Math.max(1, pSize)
          gCtx.beginPath()
          gCtx.moveTo(cx, y)
          gCtx.lineTo(cx, y - trailLen)
          gCtx.stroke()
          gCtx.lineWidth = prevLineW
          _lastStyle = ''
        }
      }
    }
  }

  gCtx.globalAlpha = 1
}

// ── Animation loop ────────────────────────────────────────────────

function loop(): void {
  animId = requestAnimationFrame(loop)
  frame++
  renderSingleFrame()
}
