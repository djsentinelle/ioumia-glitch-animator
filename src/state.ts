import type { Particle, Settings, Tint, Cursor, FxSettings } from './types'

export const importCdn: (url: string) => Promise<Record<string, unknown>> =
  new Function('url', 'return import(url)') as (url: string) => Promise<Record<string, unknown>>

// ── DOM refs (never reassigned) ──────────────────────────────────
export const renderPane    = document.getElementById('renderPane')    as HTMLElement
export const zoomContainer = document.getElementById('zoomContainer') as HTMLElement
export const zoomBar       = document.getElementById('zoomBar')       as HTMLElement
export const zoomLabelEl   = document.getElementById('zoomLabel')     as HTMLElement
export const dropZone      = document.getElementById('dropZone')      as HTMLElement
export const fileInput     = document.getElementById('fileInput')     as HTMLInputElement
export const wrapper       = document.getElementById('canvasWrapper') as HTMLElement
export const mainCanvas    = document.getElementById('mainCanvas')    as HTMLCanvasElement
export const glitchCanvas  = document.getElementById('glitchCanvas') as HTMLCanvasElement
export const mCtx          = mainCanvas.getContext('2d', { willReadFrequently: true })!
export const gCtx          = glitchCanvas.getContext('2d')!
export const playBtn       = document.getElementById('playBtn')       as HTMLButtonElement
export const resetBtn      = document.getElementById('resetBtn')      as HTMLButtonElement
export const controls      = document.getElementById('controls')      as HTMLElement
export const recBadge      = document.getElementById('recBadge')      as HTMLElement
export const recBtn        = document.getElementById('recBtn')        as HTMLButtonElement
export const dlBtn         = document.getElementById('dlBtn')         as HTMLButtonElement
export const gifBtn        = document.getElementById('gifBtn')        as HTMLButtonElement
export const dlGifBtn      = document.getElementById('dlGifBtn')      as HTMLButtonElement
export const convertTipEl  = document.getElementById('convertTip')   as HTMLElement
export const mirrorBtn     = document.getElementById('mirrorBtn')     as HTMLButtonElement
export const pixelSortBtn  = document.getElementById('pixelSortBtn') as HTMLButtonElement
export const durInput      = document.getElementById('durInput')      as HTMLInputElement
export const recTimer      = document.getElementById('recTimer')      as HTMLElement
export const recTimeEl     = document.getElementById('recTime')       as HTMLElement
export const cinemaBtn     = document.getElementById('cinemaBtn')     as HTMLButtonElement
export const cinemaHint    = document.getElementById('cinemaHint')    as HTMLElement

// ── Mutable objects (mutated in place, never reassigned) ─────────
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

export const activeModes: Set<string> = new Set(['sparkle'])

// Shared result object — avoids per-particle heap allocation
export const _ar = { x: 0, y: 0, life: 1, isRgb: false }

// Composite recording canvas
export const recCanvas = document.createElement('canvas')
export const recCtx    = recCanvas.getContext('2d')!

// ── Reassignable state bag ───────────────────────────────────────
export const state = {
  img:              null as HTMLImageElement | null,
  animId:           0,
  isPlaying:        false,
  particles:        [] as Particle[],
  modeList:         ['sparkle'] as string[],
  frame:            0,
  mirrorActive:     false,
  pixelSortActive:  false,
  lastTap:          0,
  zoomLevel:        1,
  _pixelSortTick:   0,
}

// ── Recording state bag ──────────────────────────────────────────
export const recState = {
  mediaRecorder:      null as MediaRecorder | null,
  recordedChunks:     [] as Blob[],
  recStartTime:       0,
  recTimerInterval:   0,
  lastBlobUrl:        null as string | null,
  cropBounds:         null as { x: number; y: number; w: number; h: number } | null,
  gifRecording:       false,
  gifFrames:          [] as string[],
  gifInterval:        0,
  gifAutoStop:        0,
}
