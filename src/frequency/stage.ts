const hint = document.getElementById('freqHint') as HTMLElement
const canvas = document.getElementById('freqCanvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

/** Size the canvas to the background's native resolution and draw it. */
export function showBackground(img: HTMLImageElement): void {
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  ctx.drawImage(img, 0, 0)
  hint.hidden = true
  canvas.hidden = false
}
