import { state, playBtn } from '../state'
import { renderSingleFrame, onFrame } from '../core/renderer'
import { buildParticles } from '../core/particles'
import { moveClock, startClock } from '../core/clock'
import { processedSound, timelineDuration } from '../core/sound'
import { syncVideos } from '../core/backgrounds'

const timeline = document.getElementById('timeline') as HTMLElement
const track = document.getElementById('tlTrack') as HTMLElement
const wave = document.getElementById('tlWave') as HTMLCanvasElement
const head = document.getElementById('tlHead') as HTMLElement
const ticks = document.getElementById('tlTicks') as HTMLElement
const timeEl = document.getElementById('tlTime') as HTMLElement
const totalEl = document.getElementById('tlTotal') as HTMLElement
const playEl = document.getElementById('tlPlay') as HTMLButtonElement
const noSound = document.getElementById('tlNoSound') as HTMLElement

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

const currentTime = (): number => Math.min(state.frame / 60, timelineDuration())

function updatePlayhead(): void {
  const t = currentTime()
  head.style.left = `${(t / timelineDuration()) * 100}%`
  timeEl.textContent = formatTime(t)
  playEl.textContent = state.isPlaying ? '■' : '▶'
  playEl.setAttribute('aria-label', state.isPlaying ? 'stop' : 'play')
}

/** Redraws the waveform and the time marks, after any change to the sound or the duration. */
export function redrawTimeline(): void {
  const duration = timelineDuration()
  totalEl.textContent = formatTime(duration)

  const step = [1, 2, 5, 10, 15, 30, 60, 120].find(s => duration / s <= 8) ?? 300
  let marks = ''
  for (let t = 0; t <= duration + 1e-6; t += step) {
    const atEnd = t > 0 && t > duration - step / 2
    marks += `<span${atEnd ? ' class="is-end"' : ''} style="left:${(t / duration) * 100}%">${formatTime(t).replace(/\.0$/, '')}</span>`
  }
  ticks.innerHTML = marks

  const dpr = window.devicePixelRatio || 1
  const w = Math.max(1, Math.round(track.clientWidth * dpr))
  const h = Math.max(1, Math.round(track.clientHeight * dpr))
  wave.width = w
  wave.height = h
  const ctx = wave.getContext('2d')!
  ctx.clearRect(0, 0, w, h)

  const audio = processedSound()
  noSound.hidden = !!audio
  if (audio) {
    // One peak per pixel column, from every channel.
    const channels = Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c))
    const perColumn = audio.length / w
    ctx.fillStyle = '#8cc7bf'
    for (let x = 0; x < w; x++) {
      const from = Math.floor(x * perColumn)
      const to = Math.min(audio.length, Math.floor((x + 1) * perColumn))
      let peak = 0
      for (const data of channels) {
        for (let i = from; i < to; i++) {
          const v = Math.abs(data[i])
          if (v > peak) peak = v
        }
      }
      const bar = Math.max(1, peak * h * 0.9)
      ctx.fillRect(x, (h - bar) / 2, 1, bar)
    }
  }
  updatePlayhead()
}

/** Jumps to `t` seconds. While stopped, the frame at that time is drawn so you can see where you are. */
function seek(t: number, scrubbing: boolean): void {
  t = Math.max(0, Math.min(t, timelineDuration() - 1 / 60))
  state.frame = Math.round(t * 60)
  if (state.isPlaying) {
    if (scrubbing) moveClock(t); else startClock(t)
  } else if (state.img) {
    syncVideos(t)
    if (!state.particles.length) buildParticles()
    renderSingleFrame()
  }
  updatePlayhead()
}

const timeAt = (e: PointerEvent): number => {
  const rect = track.getBoundingClientRect()
  return ((e.clientX - rect.left) / rect.width) * timelineDuration()
}

export function showTimeline(visible: boolean): void {
  timeline.hidden = !visible
  if (visible) requestAnimationFrame(redrawTimeline)
}

export function initTimeline(): void {
  onFrame(updatePlayhead)

  track.addEventListener('pointerdown', e => {
    track.setPointerCapture(e.pointerId)
    seek(timeAt(e), true)
  })
  track.addEventListener('pointermove', e => {
    if (track.hasPointerCapture(e.pointerId)) seek(timeAt(e), true)
  })
  track.addEventListener('pointerup', e => {
    if (!track.hasPointerCapture(e.pointerId)) return
    track.releasePointerCapture(e.pointerId)
    seek(timeAt(e), false)
  })

  track.addEventListener('keydown', e => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    seek(currentTime() + d * (e.shiftKey ? 1 : 0.1), false)
  })

  playEl.addEventListener('click', () => playBtn.click())
  new ResizeObserver(() => { if (!timeline.hidden) redrawTimeline() }).observe(track)
}
