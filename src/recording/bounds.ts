export function getDrawingBounds(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const w = canvas.width, h = canvas.height
  const data = ctx.getImageData(0, 0, w, h).data
  let minX = w, minY = h, maxX = 0, maxY = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3
      if (data[i + 3] > 10 && brightness > 8) {
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
