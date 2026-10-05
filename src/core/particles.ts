import { state, settings, mainCanvas, glitchCanvas, mCtx } from '../state'
import type { Particle } from '../types'
import { resizeBackgrounds } from './backgrounds'
import { baseSource } from './base'

// The particles are read from the clean drawing, before tint, mirror or glitch.
const scratch = document.createElement('canvas')
const scratchCtx = scratch.getContext('2d', { willReadFrequently: true })!

// Each particle is sampled at a random spot inside its grid cell: dots on a regular grid read as a
// halftone screen over the drawing, scattered ones as grain. The offsets are kept while the grid is
// unchanged, so an animated drawing samples the same spots on every frame and doesn't flicker.
let jitter = new Uint8Array(0)
let jitterFor = ''

function cellOffsets(w: number, h: number, step: number, keep: boolean): Uint8Array {
  const key = `${w}x${h}/${step}`
  if (keep && key === jitterFor) return jitter
  const cells = Math.ceil(w / step) * Math.ceil(h / step)
  jitter = new Uint8Array(cells * 2)
  for (let i = 0; i < jitter.length; i++) jitter[i] = Math.floor(Math.random() * step)
  jitterFor = key
  return jitter
}

/** keepMotion carries each particle's motion over to the one at the same spot (animated drawings). */
export function buildParticles(keepMotion = false): void {
  const previous = keepMotion ? new Map(state.particles.map(p => [p.oy * 65536 + p.ox, p])) : null
  state.particles = []
  const w = mainCanvas.width, h = mainCanvas.height
  scratch.width = w
  scratch.height = h
  scratchCtx.drawImage(baseSource(), 0, 0, w, h)
  const data = scratchCtx.getImageData(0, 0, w, h).data
  const step = Math.max(1, Math.ceil(12 / settings.density))
  const offsets = cellOffsets(w, h, step, keepMotion)
  const cols = Math.ceil(w / step)

  for (let cy = 0, row = 0; cy < h; cy += step, row++) {
    for (let cx = 0, col = 0; cx < w; cx += step, col++) {
      const cell = (row * cols + col) * 2
      const x = Math.min(w - 1, cx + offsets[cell])
      const y = Math.min(h - 1, cy + offsets[cell + 1])
      const i = (y * w + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
      const maxChannel = Math.max(r, g, b)
      if (a > 30 && maxChannel > 12) {
        const boost  = Math.min(255, Math.round(r * 2.5))
        const gboost = Math.min(255, Math.round(g * 2.5))
        const bboost = Math.min(255, Math.round(b * 2.5))
        const weightedA = Math.min(255, Math.round((maxChannel / 255) * 255 * 2))
        const p: Particle = {
          ox: x, oy: y, x, y,
          r: boost, g: gboost, b: bboost, a: weightedA,
          phase: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random() * 1.5,
          size:  0.5 + Math.random() * 1.5,
          vx: 0, vy: 0,
          life: 1,
          rainY: undefined,
        }
        const old = previous?.get(y * 65536 + x)
        if (old) {
          p.x = old.x; p.y = old.y; p.vx = old.vx; p.vy = old.vy
          p.phase = old.phase; p.speed = old.speed; p.size = old.size; p.rainY = old.rainY
        }
        state.particles.push(p)
      }
    }
  }
}

export function applyResolution(): void {
  if (!state.img) return
  const factor = settings.resolution / 100
  mainCanvas.width    = Math.max(1, Math.round(state.img.naturalWidth  * factor))
  mainCanvas.height   = Math.max(1, Math.round(state.img.naturalHeight * factor))
  glitchCanvas.width  = mainCanvas.width
  glitchCanvas.height = mainCanvas.height
  mCtx.drawImage(baseSource(), 0, 0, mainCanvas.width, mainCanvas.height)
  resizeBackgrounds()
  buildParticles()
}
