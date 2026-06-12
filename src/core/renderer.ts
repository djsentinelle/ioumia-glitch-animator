import {
  state, settings, tint, fx,
  mainCanvas, glitchCanvas, mCtx, gCtx,
  playBtn, recBadge,
} from '../state'
import { applyMode } from '../effects'
import { buildParticles } from './particles'

export function renderSingleFrame(): void {
  const w = mainCanvas.width, h = mainCanvas.height
  const spd       = settings.speed / 4
  const glitchAmt = settings.glitch

  mCtx.clearRect(0, 0, w, h)
  mCtx.globalAlpha = 1
  mCtx.drawImage(state.img!, 0, 0, w, h)

  // RGB Color Overlay (multiply blend — skips black, preserves white)
  if (tint.r !== 0 || tint.g !== 0 || tint.b !== 0) {
    const cr = Math.round(255 + tint.r)
    const cg = Math.round(255 + tint.g)
    const cb = Math.round(255 + tint.b)
    const strength = Math.max(255 - cr, 255 - cg, 255 - cb) / 255
    mCtx.save()
    mCtx.globalCompositeOperation = 'multiply'
    mCtx.globalAlpha = strength * 0.85
    mCtx.fillStyle = `rgb(${cr},${cg},${cb})`
    mCtx.fillRect(0, 0, w, h)
    mCtx.restore()
  }

  // Mirror
  if (state.mirrorActive) {
    mCtx.save()
    mCtx.translate(w, 0)
    mCtx.scale(-1, 1)
    mCtx.drawImage(mainCanvas, 0, 0, w / 2, h, 0, 0, w / 2, h)
    mCtx.restore()
  }

  // Pixel Sort (every 3 frames)
  state._pixelSortTick++
  if (state.pixelSortActive && state._pixelSortTick % 3 === 0) {
    const imgData   = mCtx.getImageData(0, 0, w, h)
    const d         = imgData.data
    const numRows   = Math.floor(h * 0.15)
    const threshold = 6
    for (let s = 0; s < numRows; s++) {
      const row  = Math.floor(Math.random() * h)
      const base = row * w * 4
      let segStart = -1
      const flush = (end: number) => {
        if (segStart < 0 || end - segStart < 3) return
        const pixels: Array<{ r: number; g: number; b: number; a: number; lum: number }> = []
        for (let x = segStart; x < end; x++) {
          const i = base + x * 4
          pixels.push({ r: d[i], g: d[i+1], b: d[i+2], a: d[i+3],
                        lum: 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2] })
        }
        pixels.sort((a, b) => a.lum - b.lum)
        for (let x = segStart; x < end; x++) {
          const i  = base + x * 4
          const px = pixels[x - segStart]
          d[i] = px.r; d[i+1] = px.g; d[i+2] = px.b; d[i+3] = px.a
        }
        segStart = -1
      }
      for (let x = 0; x < w; x++) {
        const i      = base + x * 4
        const bright = (d[i] + d[i+1] + d[i+2]) / 3
        if (bright > threshold) { if (segStart < 0) segStart = x }
        else flush(x)
      }
      flush(w)
    }
    mCtx.putImageData(imgData, 0, 0)
  }

  // Glitch horizontal slices
  if (glitchAmt > 0 && state.frame % Math.max(1, Math.floor(8 - glitchAmt)) === 0) {
    const numSlices = Math.floor(glitchAmt * 0.8)
    for (let s = 0; s < numSlices; s++) {
      const sy     = Math.random() * h
      const sh     = 2 + Math.random() * (glitchAmt * 3)
      const offset = (Math.random() - 0.5) * glitchAmt * 8
      mCtx.drawImage(state.img!, 0, sy, w, sh, offset, sy, w, sh)
      if (Math.random() < 0.4) {
        mCtx.globalAlpha = 0.3
        mCtx.globalCompositeOperation = 'screen'
        mCtx.drawImage(state.img!, 0, sy, w, sh, offset + 3, sy, w, sh)
        mCtx.drawImage(state.img!, 0, sy, w, sh, offset - 3, sy, w, sh)
        mCtx.globalCompositeOperation = 'source-over'
        mCtx.globalAlpha = 1
      }
    }
  }

  // Draw particles
  gCtx.clearRect(0, 0, w, h)
  const stride = state.particles.length > 20000 ? Math.ceil(state.particles.length / 20000) : 1
  const pSize  = settings.size * 0.8
  const { modeList } = state

  let _lastStyle = ''
  let _lastAlpha = -1

  for (const m of modeList) {
    for (let _pi = 0; _pi < state.particles.length; _pi += stride) {
      const p = state.particles[_pi]
      const t = state.frame * spd * p.speed + p.phase
      const { x, y, life, isRgb } = applyMode(m, p, t)

      const alpha = Math.min(1, life * (p.a / 255) * (modeList.length > 1 ? 0.75 : 1))
      if (alpha < 0.05) continue

      if (isRgb) {
        const rOff = fx.rgb.spread * 0.7
        if (alpha !== _lastAlpha) { gCtx.globalAlpha = alpha; _lastAlpha = alpha }
        const s1 = `rgb(255,${p.g},${p.b})`
        if (s1 !== _lastStyle) { gCtx.fillStyle = s1; _lastStyle = s1 }
        gCtx.fillRect(x - rOff, p.oy, pSize, pSize)
        const s2 = `rgb(${p.r},255,${p.b})`
        if (s2 !== _lastStyle) { gCtx.fillStyle = s2; _lastStyle = s2 }
        gCtx.fillRect(x, p.oy, pSize, pSize)
        const s3 = `rgb(${p.r},${p.g},255)`
        if (s3 !== _lastStyle) { gCtx.fillStyle = s3; _lastStyle = s3 }
        gCtx.fillRect(x + rOff, p.oy, pSize, pSize)
      } else {
        const pBright = (p.r + p.g + p.b) / 3
        let pr = p.r, pg = p.g, pb = p.b
        if (pBright <= 200 && (tint.r !== 0 || tint.g !== 0 || tint.b !== 0)) {
          const strength = Math.min(1, Math.max(Math.abs(tint.r), Math.abs(tint.g), Math.abs(tint.b)) / 255)
          const tr = tint.r >= 0 ? 255 - (255 - p.r) * (255 - tint.r) / 255 : p.r * (255 + tint.r) / 255
          const tg = tint.g >= 0 ? 255 - (255 - p.g) * (255 - tint.g) / 255 : p.g * (255 + tint.g) / 255
          const tb = tint.b >= 0 ? 255 - (255 - p.b) * (255 - tint.b) / 255 : p.b * (255 + tint.b) / 255
          pr = Math.max(0, Math.min(255, Math.round(p.r + (tr - p.r) * strength)))
          pg = Math.max(0, Math.min(255, Math.round(p.g + (tg - p.g) * strength)))
          pb = Math.max(0, Math.min(255, Math.round(p.b + (tb - p.b) * strength)))
        }
        const style     = `rgb(${pr},${pg},${pb})`
        const glowAlpha = alpha * 0.25
        if (glowAlpha !== _lastAlpha) { gCtx.globalAlpha = glowAlpha; _lastAlpha = glowAlpha }
        if (style !== _lastStyle)     { gCtx.fillStyle = style;       _lastStyle = style }
        gCtx.fillRect(x - 1, y - 1, pSize + 2, pSize + 2)
        if (alpha !== _lastAlpha) { gCtx.globalAlpha = alpha; _lastAlpha = alpha }
        gCtx.fillRect(x, y, pSize, pSize)

        // Rain shooting-star trail
        if (m === 'rain' && fx.rain.trail > 0) {
          const trailLen = fx.rain.trail * 6
          const fadeMid  = Math.max(0.02, 1 - fx.rain.fade / 11)
          const cx       = x + pSize / 2
          const grad     = gCtx.createLinearGradient(cx, y, cx, y - trailLen)
          grad.addColorStop(0,       `rgba(${pr},${pg},${pb},${alpha})`)
          grad.addColorStop(fadeMid, `rgba(${pr},${pg},${pb},${(alpha * 0.15).toFixed(3)})`)
          grad.addColorStop(1,       `rgba(${pr},${pg},${pb},0)`)
          const prevLineW   = gCtx.lineWidth
          gCtx.globalAlpha  = 1; _lastAlpha = 1
          gCtx.strokeStyle  = grad
          gCtx.lineWidth    = Math.max(1, pSize)
          gCtx.beginPath()
          gCtx.moveTo(cx, y)
          gCtx.lineTo(cx, y - trailLen)
          gCtx.stroke()
          gCtx.lineWidth = prevLineW
          _lastStyle = ''
        }
      }
    }
  }

  gCtx.globalAlpha = 1
}

function loop(): void {
  state.animId = requestAnimationFrame(loop)
  state.frame++
  renderSingleFrame()
}

// startAnim / stopAnim live here (not in ui/) so recording modules can call
// them without creating a circular dependency with ui/controls.ts

export function startAnim(): void {
  state.isPlaying = true
  playBtn.textContent = '■  STOP'
  playBtn.classList.add('active')
  recBadge.classList.add('show')
  buildParticles()
  loop()
}

export function stopAnim(): void {
  state.isPlaying = false
  if (state.animId !== null) cancelAnimationFrame(state.animId)
  playBtn.textContent = '▶  PLAY'
  playBtn.classList.remove('active')
  recBadge.classList.remove('show')
  if (state.img) {
    mCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height)
    mCtx.drawImage(state.img, 0, 0, mainCanvas.width, mainCanvas.height)
    gCtx.clearRect(0, 0, glitchCanvas.width, glitchCanvas.height)
  }
}
