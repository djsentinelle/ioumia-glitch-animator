export interface Particle {
  ox: number; oy: number
  x: number;  y: number
  r: number;  g: number; b: number; a: number
  phase: number; speed: number; size: number
  vx: number; vy: number
  life: number
  rainY: number | undefined
}

export interface Settings {
  intensity: number; speed: number; size: number; glitch: number
  sparkle: number; density: number; resolution: number
  [key: string]: number
}

export interface Tint { r: number; g: number; b: number; [key: string]: number }
export interface Cursor { x: number; y: number; active: boolean }
export interface CropBounds { x: number; y: number; w: number; h: number }
export interface ApplyResult { x: number; y: number; life: number; isRgb: boolean }

export interface FxEffect { [key: string]: number }
export interface FxSettings {
  sparkle: FxEffect; drift: FxEffect; pulse: FxEffect; rain: FxEffect
  explode: FxEffect; rgb: FxEffect; blow: FxEffect
  [key: string]: FxEffect
}

declare global {
  class GIF {
    constructor(opts: Record<string, unknown>)
    addFrame(canvas: HTMLCanvasElement, opts?: Record<string, unknown>): void
    render(): void
    on(event: string, cb: (blob: Blob) => void): void
  }
}
