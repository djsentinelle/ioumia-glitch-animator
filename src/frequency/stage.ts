/** Canvas for the frequency background animator, kept at the stage's pixel size. */
export function initStage(): void {
  const stage = document.getElementById('freqStage') as HTMLDivElement
  const canvas = document.getElementById('freqCanvas') as HTMLCanvasElement
  const ctx = canvas.getContext('2d')!

  const resize = (): void => {
    const dpr = window.devicePixelRatio || 1
    const { width, height } = stage.getBoundingClientRect()
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    draw(ctx, canvas.width, canvas.height)
  }

  new ResizeObserver(resize).observe(stage)
  resize()
}

/** Placeholder frame. The animation replaces this. */
function draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
}
