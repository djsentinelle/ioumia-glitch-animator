import type { Particle, Settings, Tint, Cursor, CropBounds, FxSettings, ApplyResult } from './types'

// Bypass TypeScript module resolution for CDN dynamic imports
export const importCdn = new Function('url', 'return import(url)') as
  (url: string) => Promise<Record<string, unknown>>

// ── DOM refs (constants — never reassigned) ───────────────────────

export const renderPane    = document.getElementById('renderPane')    as HTMLDivElement
export const zoomContainer = document.getElementById('zoomContainer') as HTMLDivElement
export const zoomBar       = document.getElementById('zoomBar')       as HTMLDivElement
export const zoomLabelEl   = document.getElementById('zoomLabel')     as HTMLSpanElement

export const dropZone     = document.getElementById('dropZone')      as HTMLDivElement
export const fileInput    = document.getElementById('fileInput')     as HTMLInputElement
export const wrapper      = document.getElementById('canvasWrapper') as HTMLDivElement
export const mainCanvas   = document.getElementById('mainCanvas')    as HTMLCanvasElement
export const glitchCanvas = document.getElementById('glitchCanvas') as HTMLCanvasElement
export const mCtx         = mainCanvas.getContext('2d')!
export const gCtx         = glitchCanvas.getContext('2d')!
export const playBtn      = document.getElementById('playBtn')       as HTMLButtonElement
export const resetBtn     = document.getElementById('resetBtn')      as HTMLButtonElement
export const controls     = document.getElementById('controls')      as HTMLDivElement
export const recBadge     = document.getElementById('recBadge')      as HTMLDivElement
export const recBtn       = document.getElementById('recBtn')        as HTMLButtonElement
export const dlBtn        = document.getElementById('dlBtn')         as HTMLButtonElement
export const gifBtn       = document.getElementById('gifBtn')        as HTMLButtonElement
export const dlGifBtn     = document.getElementById('dlGifBtn')      as HTMLButtonElement
export const convertTipEl = document.getElementById('convertTip')    as HTMLDivElement
export const mirrorBtn    = document.getElementById('mirrorBtn')     as HTMLButtonElement
export const pixelSortBtn = document.getElementById('pixelSortBtn')  as HTMLButtonElement
export const durInput     = document.getElementById('durInput')      as HTMLInputElement
export const recTimer     = document.getElementById('recTimer')      as HTMLDivElement
export const recTimeEl    = document.getElementById('recTime')       as HTMLSpanElement
export const cinemaBtn    = document.getElementById('cinemaBtn')     as HTMLButtonElement
export const cinemaHint   = document.getElementById('cinemaHint')    as HTMLDivElement

// Recording canvas (created once)
export const recCanvas = document.createElement('canvas')
export const recCtx    = recCanvas.getContext('2d')!

// ── Objects mutated in place (const refs, mutable properties) ─────

export const settings: Settings = {
  intensity: 5, speed: 4, size: 2, glitch: 3, sparkle: 5, density: 5, resolution: 100,
}

export const tint: Tint = { r: 0, g: 0, b: 0 }

export const cursor: Cursor = { x: -9999, y: -9999, active: false }

export const fx: FxSettings = {
  sparkle: { radius: 5,  speed: 4 },
  drift:   { amp: 4,     speed: 4 },
  pulse:   { scale: 8,   speed: 4 },
  rain:    { speed: 4,   opacity: 5, trail: 8, fade: 5 },
  explode: { force: 8,   speed: 4 },
  rgb:     { spread: 3,  speed: 4 },
  blow:    { force: 10,  radius: 80, chaos: 0 },
}

// Shared render result — avoids per-particle heap allocation
export const _ar: ApplyResult = { x: 0, y: 0, life: 1, isRgb: false }

export const activeModes = new Set<string>(['sparkle'])

// ── Mutable state bag (primitives/refs that get reassigned) ───────

export const state = {
  img:            null as HTMLImageElement | null,
  animId:         null as number | null,
  isPlaying:      false,
  particles:      [] as Particle[],
  modeList:       ['sparkle'] as string[],
  frame:          0,
  mirrorActive:   false,
  pixelSortActive: false,
  lastTap:        0,
  zoomLevel:      1,
  _pixelSortTick: 0,
}

// ── Recording mutable state ───────────────────────────────────────

export const recState = {
  mediaRecorder:    null as MediaRecorder | null,
  recordedChunks:   [] as BlobPart[],
  recStartTime:     null as number | null,
  recTimerInterval: null as ReturnType<typeof setInterval> | null,
  lastBlobUrl:      null as string | null,
  cropBounds:       null as CropBounds | null,
  gifRecording:     false,
  gifFrames:        [] as string[],
  gifInterval:      null as ReturnType<typeof setInterval> | null,
  gifAutoStop:      null as ReturnType<typeof setTimeout> | null,
}
