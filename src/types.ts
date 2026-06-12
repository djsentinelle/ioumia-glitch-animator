export interface Particle {
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

export interface Settings {
  intensity: number
  speed: number
  size: number
  glitch: number
  sparkle: number
  density: number
  resolution: number
  [key: string]: number
}

export interface Tint {
  r: number; g: number; b: number
  [key: string]: number
}

export interface Cursor {
  x: number; y: number; active: boolean
}

export interface CropBounds {
  x: number; y: number; w: number; h: number
}

export interface ApplyResult {
  x: number; y: number; life: number; isRgb: boolean
}

export interface FxSettings {
  sparkle: { radius: number; speed: number }
  drift:   { amp: number;    speed: number }
  pulse:   { scale: number;  speed: number }
  rain:    { speed: number;  opacity: number; trail: number; fade: number }
  explode: { force: number;  speed: number }
  rgb:     { spread: number; speed: number }
  blow:    { force: number;  radius: number; chaos: number }
  [key: string]: Record<string, number>
}

// GIF.js loaded dynamically via CDN script tag
declare global {
  class GIF {
    constructor(options: { workers: number; quality: number; width: number; height: number; workerScript: string })
    addFrame(canvas: HTMLCanvasElement, options: { delay: number }): void
    render(): void
    on(event: 'finished', cb: (blob: Blob) => void): void
  }
}
