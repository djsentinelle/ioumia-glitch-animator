import { state, settings, mainCanvas, glitchCanvas, mCtx } from '../state'

export function buildParticles(): void {
  state.particles = []
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
        state.particles.push({
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

export function applyResolution(): void {
  if (!state.img) return
  const factor = settings.resolution / 100
  mainCanvas.width    = Math.max(1, Math.round(state.img.naturalWidth  * factor))
  mainCanvas.height   = Math.max(1, Math.round(state.img.naturalHeight * factor))
  glitchCanvas.width  = mainCanvas.width
  glitchCanvas.height = mainCanvas.height
  mCtx.drawImage(state.img, 0, 0, mainCanvas.width, mainCanvas.height)
  buildParticles()
}
