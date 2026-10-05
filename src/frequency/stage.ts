const hint = document.getElementById('freqHint') as HTMLElement
export const canvas = document.getElementById('freqCanvas') as HTMLCanvasElement
export const ctx = canvas.getContext('2d')!

/** Size the canvas to the background's native resolution. The renderer draws it each frame. */
export function showBackground(img: HTMLImageElement): void {
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  hint.hidden = true
  canvas.hidden = false
}
