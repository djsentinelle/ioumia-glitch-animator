import { inputs, settings, spectrum, fx } from './state'
import { canvas, ctx } from './stage'
import { readLevels } from './audio'

/** Exponent applied to levels so only the strong frequencies light up. */
const CONTRAST = 3
/** Half-width of a band's solid core, in band slots. */
const CORE = 0.2
/** Blur at 10 spreads a band by this many slots (gaussian sigma). */
const MAX_SIGMA = 1.2
/** Aberration at 10 pushes the red and blue channels apart by this many slots each. */
const MAX_SHIFT = 0.5
/** Noise speckles drawn per frame at full noise and full level, shared between all bands. */
const NOISE_BUDGET = 6000

const STREAK_COLORS = ['#7ff', '#fe8', '#f9d', '#fff']
const NOISE_COLORS = ['#f55', '#6f6', '#59f', '#fe5', '#f9d', '#7ff', '#fff']

// A band's cross-section is stored as a 1px-thick strip, one per colour channel
// so chromatic aberration can offset them. The strip spans EXTENT slots.
const SPRITE_SIZE = 256
const EXTENT = 8
type Sprites = { x: HTMLCanvasElement[]; y: HTMLCanvasElement[]; reach: number }
let sprites: Sprites | null = null
let spritesBlur = -1

let levels = new Float32Array(0)

/** Abramowitz-Stegun approximation, accurate to about 1e-7. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t
  return sign * (1 - poly * Math.exp(-ax * ax))
}

/** Build the band cross-section for a blur amount: a solid core, gaussian-blurred, pink to pale to lilac. */
function buildSprites(blur: number): Sprites {
  const sigma = (blur / 10) * MAX_SIGMA
  const alpha = new Float32Array(SPRITE_SIZE)
  let peak = 0
  for (let i = 0; i < SPRITE_SIZE; i++) {
    const pos = ((i + 0.5) / SPRITE_SIZE - 0.5) * EXTENT // in slots, 0 at the band centre
    alpha[i] =
      sigma < 0.02
        ? Math.abs(pos) <= CORE ? 1 : 0
        : 0.5 * (erf((pos + CORE) / (sigma * Math.SQRT2)) - erf((pos - CORE) / (sigma * Math.SQRT2)))
    if (alpha[i] > peak) peak = alpha[i]
  }

  // The colour ramp follows the visible width so the edges stay tinted at any blur.
  const visible = CORE + 2 * sigma + 0.05
  const edgeLow = [255, 140, 205]
  const core = [255, 235, 250]
  const edgeHigh = [150, 170, 255]

  const make = (alongX: boolean, channel: number): HTMLCanvasElement => {
    const sprite = document.createElement('canvas')
    sprite.width = alongX ? SPRITE_SIZE : 1
    sprite.height = alongX ? 1 : SPRITE_SIZE
    const g = sprite.getContext('2d')!
    const image = g.createImageData(sprite.width, sprite.height)
    for (let i = 0; i < SPRITE_SIZE; i++) {
      const pos = ((i + 0.5) / SPRITE_SIZE - 0.5) * EXTENT
      const t = Math.max(-1, Math.min(1, pos / visible))
      const edge = t < 0 ? edgeLow : edgeHigh
      const mix = Math.abs(t)
      image.data[i * 4 + channel] = core[channel] + (edge[channel] - core[channel]) * mix
      image.data[i * 4 + 3] = (alpha[i] / peak) * 255
    }
    g.putImageData(image, 0, 0)
    return sprite
  }

  return {
    x: [0, 1, 2].map(c => make(true, c)),
    y: [0, 1, 2].map(c => make(false, c)),
    reach: Math.min(EXTENT / 2, CORE + 3 * sigma + 0.1), // slots from the centre that are not empty
  }
}

function frame(): void {
  requestAnimationFrame(frame)
  const background = inputs.background
  if (!background) return

  if (!sprites || spritesBlur !== fx.blur) {
    sprites = buildSprites(fx.blur)
    spritesBlur = fx.blur
  }
  const { reach } = sprites

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
  const slot = length / n
  const unit = Math.max(W, H) / 1400 // keeps details the same relative size on any image
  const shift = (fx.aberration / 10) * MAX_SHIFT * slot
  const glitch = fx.glitch / 10
  const channels = onWidth ? sprites.x : sprites.y

  // Only the non-empty middle of the sprite is drawn.
  const srcStart = SPRITE_SIZE * (0.5 - reach / EXTENT)
  const srcSize = SPRITE_SIZE * ((2 * reach) / EXTENT)
  const size = 2 * reach * slot

  /** Draw a stretch of one band, its three colour channels pushed apart by the aberration. */
  const drawBand = (centre: number, from: number, extent: number): void => {
    for (let c = 0; c < 3; c++) {
      const at = centre + (c - 1) * shift - size / 2
      if (onWidth) ctx.drawImage(channels[c], srcStart, 0, srcSize, 1, at, from, size, extent)
      else ctx.drawImage(channels[c], 0, srcStart, 1, srcSize, from, at, extent, size)
    }
  }

  /** Lows start at the left (width) or the bottom (height). Invert flips that. */
  const centreOf = (i: number): number => {
    let t = (i + 0.5) / n
    if (onWidth === settings.invert) t = 1 - t
    return t * length
  }

  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < n; i++) {
    const level = levels[i]
    if (level < 0.02) continue
    const centre = centreOf(i)
    const strength = level ** CONTRAST

    ctx.globalAlpha = strength
    drawBand(centre, 0, span)

    if (glitch === 0) continue

    // Glitch, part 1: now and then a slice of the band jumps sideways.
    if (Math.random() < glitch * level * 0.5) {
      const from = Math.random() * span
      const jump = (Math.random() - 0.5) * slot * glitch * 4
      ctx.globalAlpha = strength * 0.8
      drawBand(centre + jump, from, (20 + Math.random() * 120) * unit)
    }

    // Glitch, part 2: short dashes across the band's edges.
    ctx.globalAlpha = level * 0.6
    const streaks = Math.floor(level * level * glitch * 12 + Math.random())
    for (let s = 0; s < streaks; s++) {
      const along = Math.random() * span
      const across = centre + (Math.random() - 0.5) * size * 0.9
      const long = (4 + Math.random() * 26) * unit * (0.5 + glitch)
      const thick = Math.max(1, Math.round(unit * (1 + Math.random())))
      ctx.fillStyle = STREAK_COLORS[(Math.random() * STREAK_COLORS.length) | 0]
      if (onWidth) ctx.fillRect(across, along, long, thick)
      else ctx.fillRect(along, across, thick, long)
    }
  }

  // Noise: coloured speckles scattered around each active band, densest at its centre.
  if (fx.noise > 0) {
    ctx.globalCompositeOperation = 'source-over'
    const grain = Math.max(1, Math.round(unit * 1.5))
    const spread = Math.max(size * 0.35, 6 * unit)
    for (let i = 0; i < n; i++) {
      const level = levels[i]
      if (level < 0.1) continue
      const centre = centreOf(i)
      const count = Math.round(((fx.noise / 10) * level * NOISE_BUDGET) / n)
      ctx.globalAlpha = 0.35 + level * 0.6
      for (let s = 0; s < count; s++) {
        const along = Math.random() * span
        // Sum of three uniforms: a cheap bell curve between -1.5 and 1.5.
        const across = centre + (Math.random() + Math.random() + Math.random() - 1.5) * spread
        ctx.fillStyle = NOISE_COLORS[(Math.random() * NOISE_COLORS.length) | 0]
        if (onWidth) ctx.fillRect(across, along, grain, grain)
        else ctx.fillRect(along, across, grain, grain)
      }
    }
  }
}

export function startRenderer(): void {
  requestAnimationFrame(frame)
}
