import { state, mainCanvas, glitchCanvas } from '../state'
import { bgCanvas, bgSettings, hasBackground } from '../core/backgrounds'
import { getDrawingBounds } from './bounds'

export type Bounds = { x: number; y: number; w: number; h: number }

/** Draws one output frame — backgrounds, drawing, particles — cropped to `b`. */
export function compositeFrame(ctx: CanvasRenderingContext2D, b: Bounds): void {
  ctx.clearRect(0, 0, b.w, b.h)
  if (hasBackground()) ctx.drawImage(bgCanvas, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h)
  ctx.globalCompositeOperation = bgSettings.blend
  ctx.drawImage(mainCanvas, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h)
  ctx.globalCompositeOperation = 'screen'
  ctx.drawImage(glitchCanvas, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h)
  ctx.globalCompositeOperation = 'source-over'
}

/** With a background or an animated drawing the whole frame is recorded; otherwise just the drawing. */
export function recordingBounds(): Bounds {
  return hasBackground() || state.gif
    ? { x: 0, y: 0, w: mainCanvas.width, h: mainCanvas.height }
    : getDrawingBounds(mainCanvas)
}
