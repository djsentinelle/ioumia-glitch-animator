import { inputs, settings, spectrum } from './state'
import { canvas, ctx } from './stage'
import { readLevels } from './audio'

/** Glow width, in band slots. Above 1 so neighbouring bands blend. */
const GLOW = 3
/** Exponent applied to levels so only the strong frequencies light up. */
const CONTRAST = 3
const STREAK_COLORS = ['#7ff', '#fe8', '#f9d', '#fff']

const SPRITE_SIZE = 64
const spriteX = makeSprite(true)
const spriteY = makeSprite(false)

let levels = new Float32Array(0)

/** One band's cross-section: a pale core between pink and lilac edges, fading to nothing. */
function makeSprite(alongX: boolean): HTMLCanvasElement {
  const sprite = document.createElement('canvas')
  sprite.width = alongX ? SPRITE_SIZE : 1
  sprite.height = alongX ? 1 : SPRITE_SIZE
  const g = sprite.getContext('2d')!
  const gradient = alongX
    ? g.createLinearGradient(0, 0, SPRITE_SIZE, 0)
    : g.createLinearGradient(0, 0, 0, SPRITE_SIZE)
  gradient.addColorStop(0, 'rgba(150,170,255,0)')
  gradient.addColorStop(0.3, 'rgba(255,150,210,0.3)')
  gradient.addColorStop(0.44, 'rgba(255,175,225,0.9)')
  gradient.addColorStop(0.5, 'rgba(255,240,250,1)')
  gradient.addColorStop(0.57, 'rgba(190,180,255,0.9)')
  gradient.addColorStop(0.7, 'rgba(140,200,255,0.3)')
  gradient.addColorStop(1, 'rgba(140,200,255,0)')
  g.fillStyle = gradient
  g.fillRect(0, 0, sprite.width, sprite.height)
  return sprite
}

function frame(): void {
  requestAnimationFrame(frame)
  const background = inputs.background
  if (!background) return

  const W = canvas.width
  const H = canvas.height
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.clearRect(0, 0, W, H)
  ctx.drawImage(background, 0, 0)

  const n = settings.bands
  if (levels.length !== n) levels = new Float32Array(n)
  readLevels(levels, spectrum.range)

  const onWidth = settings.axis === 'x'
  const length = onWidth ? W : H // along the frequency axis
  const span = onWidth ? H : W // along each band
  const glow = (length / n) * GLOW
  const unit = Math.max(W, H) / 1400 // keeps streaks the same relative size on any image

  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < n; i++) {
    const level = levels[i]
    if (level < 0.02) continue

    // Lows start at the left (width) or the bottom (height). Invert flips that.
    let t = (i + 0.5) / n
    if (onWidth === settings.invert) t = 1 - t
    const centre = t * length

    ctx.globalAlpha = level ** CONTRAST
    if (onWidth) ctx.drawImage(spriteX, centre - glow / 2, 0, glow, H)
    else ctx.drawImage(spriteY, 0, centre - glow / 2, W, glow)

    // Glitch streaks: short dashes across the band's edges.
    ctx.globalAlpha = level * 0.6
    const streaks = Math.floor(level * level * 5 + Math.random())
    for (let s = 0; s < streaks; s++) {
      const along = Math.random() * span
      const across = centre + (Math.random() - 0.5) * glow * 0.9
      const long = (4 + Math.random() * 26) * unit
      const thick = Math.max(1, Math.round(unit * (1 + Math.random())))
      ctx.fillStyle = STREAK_COLORS[(Math.random() * STREAK_COLORS.length) | 0]
      if (onWidth) ctx.fillRect(across, along, long, thick)
      else ctx.fillRect(along, across, thick, long)
    }
  }
}

export function startRenderer(): void {
  requestAnimationFrame(frame)
}
