import type { Particle, ApplyResult } from './types'
import { state, _ar, fx, cursor, mainCanvas } from './state'

export function applyMode(m: string, p: Particle, t: number): ApplyResult {
  const w = mainCanvas.width, h = mainCanvas.height
  _ar.x = p.x; _ar.y = p.y; _ar.life = p.life; _ar.isRgb = false

  if (m === 'sparkle') {
    const sparkleRadius = fx.sparkle.radius * 0.6
    const spd2 = fx.sparkle.speed / 4
    _ar.x    = p.ox + (Math.random() - 0.5) * sparkleRadius
    _ar.y    = p.oy + (Math.random() - 0.5) * sparkleRadius
    _ar.life = 0.3 + 0.7 * Math.abs(Math.sin(state.frame * spd2 * p.speed * 0.05 + p.phase))

  } else if (m === 'drift') {
    const dSpd = fx.drift.speed / 4
    const dAmp = fx.drift.amp
    const dt = state.frame * dSpd * p.speed * 0.02 + p.phase
    _ar.x    = p.ox + Math.sin(dt) * dAmp
    _ar.y    = p.oy + Math.cos(dt * 0.7) * dAmp * 0.75
    _ar.life = 0.5 + 0.5 * Math.sin(dt)

  } else if (m === 'pulse') {
    const pSpd   = fx.pulse.speed / 4
    const pScale = fx.pulse.scale / 100
    const pt     = state.frame * pSpd * 0.01
    const scale  = 1 + Math.sin(pt * 0.5) * pScale
    _ar.x    = p.ox * scale + (w * (1 - scale)) / 2
    _ar.y    = p.oy * scale + (h * (1 - scale)) / 2
    _ar.life = 0.4 + 0.6 * Math.abs(Math.sin(pt))

  } else if (m === 'rain') {
    if (p.rainY === undefined) p.rainY = p.oy + Math.random() * (h - p.oy)
    const rainSpd     = fx.rain.speed / 4
    const rainOpacity = fx.rain.opacity / 10
    p.rainY += rainSpd * 1.5 * p.speed
    if (p.rainY > h + 10) p.rainY = p.oy
    _ar.x = p.ox + (Math.random() - 0.5) * 0.8
    _ar.y = p.rainY
    const distFromOrigin = Math.max(0, p.rainY - p.oy) / (h - p.oy + 1)
    _ar.life = Math.max(0.05, (1 - distFromOrigin) * rainOpacity * 1.8)

  } else if (m === 'explode') {
    const cx = w / 2, cy = h / 2
    const dx = p.ox - cx, dy = p.oy - cy
    const et    = (state.frame * fx.explode.speed * 0.003) % 1
    const scale = 1 + et * fx.explode.force * 0.4
    _ar.x    = cx + dx * scale
    _ar.y    = cy + dy * scale
    _ar.life = Math.max(0, 1 - et * 1.4)

  } else if (m === 'rgb') {
    const rSpd = fx.rgb.speed / 4
    const rt   = state.frame * rSpd * p.speed * 0.02
    _ar.x      = p.ox + Math.sin(rt * 1.5) * fx.rgb.spread
    _ar.y      = p.oy
    _ar.life   = 0.6 + 0.4 * Math.abs(Math.sin(rt * 3))
    _ar.isRgb  = true

  } else if (m === 'blow') {
    const blowForce  = fx.blow.force / 10
    const dx         = p.ox - cursor.x, dy = p.oy - cursor.y
    const distSq     = dx * dx + dy * dy
    const chaosAmt   = fx.blow.chaos / 10
    const noise      = Math.sin(p.phase * 13.7) * 0.6 + Math.sin(p.phase * 7.3) * 0.4
    const blowRadius = fx.blow.radius * (1 + chaosAmt * noise * 2)
    if (distSq < blowRadius * blowRadius && distSq > 0) {
      const dist  = Math.sqrt(distSq)
      const force = (1 - dist / blowRadius) * blowRadius * 0.5 * blowForce
      p.vx += (dx / dist) * force * 0.15
      p.vy += (dy / dist) * force * 0.15
    }
    p.vx += (p.ox - p.x) * 0.08
    p.vy += (p.oy - p.y) * 0.08
    p.vx *= 0.75
    p.vy *= 0.75
    _ar.x = p.x + p.vx
    _ar.y = p.y + p.vy
    p.x = _ar.x; p.y = _ar.y
    _ar.life = 0.6 + 0.4 * Math.abs(Math.sin(t * 2 + p.phase))
  }

  return _ar
}
