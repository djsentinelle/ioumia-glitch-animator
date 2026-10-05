import {
  state, settings, tint, activeModes,
  mainCanvas, wrapper, dropZone, fileInput, controls, zoomBar,
  playBtn, resetBtn, mirrorBtn, pixelSortBtn, cinemaBtn, cinemaHint,
  cursor,
} from '../state'
import { startAnim, stopAnim } from '../core/renderer'
import { buildParticles } from '../core/particles'
import { setZoom } from './zoom'

export function initControls(): void {
  playBtn.addEventListener('click', () => { if (state.isPlaying) stopAnim(); else startAnim() })

  resetBtn.addEventListener('click', () => {
    stopAnim()
    dropZone.style.display = ''
    wrapper.classList.remove('visible')
    controls.style.display = 'none'
    zoomBar.classList.remove('visible')
    setZoom(1)
    state.img = null
    state.particles = []
    fileInput.value = ''
  })

  mirrorBtn.addEventListener('click', () => {
    state.mirrorActive = !state.mirrorActive
    mirrorBtn.classList.toggle('active', state.mirrorActive)
  })

  pixelSortBtn.addEventListener('click', () => {
    state.pixelSortActive = !state.pixelSortActive
    pixelSortBtn.classList.toggle('active', state.pixelSortActive)
  })

  document.getElementById('clearFxBtn')!.addEventListener('click', () => {
    activeModes.clear()
    state.modeList = []
    state.particles.forEach(p => { p.vx = 0; p.vy = 0; p.x = p.ox; p.y = p.oy })
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'))
    state.mirrorActive = false
    state.pixelSortActive = false
    mirrorBtn.classList.remove('active')
    pixelSortBtn.classList.remove('active')
    tint.r = 0; tint.g = 0; tint.b = 0
    ;(document.getElementById('rSlider') as HTMLInputElement).value = '0'
    ;(document.getElementById('gSlider') as HTMLInputElement).value = '0'
    ;(document.getElementById('bSlider') as HTMLInputElement).value = '0'
    document.getElementById('rVal')!.textContent = '0'
    document.getElementById('gVal')!.textContent = '0'
    document.getElementById('bVal')!.textContent = '0'
    settings.glitch = 0
    ;(document.getElementById('glitchSlider') as HTMLInputElement).value = '0'
    document.getElementById('glitchVal')!.textContent = '0'
  })

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = (btn as HTMLElement).dataset.mode
      if (!m) return
      if (activeModes.has(m)) {
        activeModes.delete(m)
        btn.classList.remove('active')
      } else {
        activeModes.add(m)
        btn.classList.add('active')
      }
      state.modeList = [...activeModes]
      buildParticles()
    })
  })

  cinemaBtn.addEventListener('click', () => {
    if (!state.isPlaying) startAnim()
    document.body.classList.add('cinema-mode')
    cinemaHint.style.animation = 'none'
    void cinemaHint.offsetWidth
    cinemaHint.style.animation = 'fadeHint 3s ease forwards'
  })

  document.addEventListener('touchend', () => {
    if (!document.body.classList.contains('cinema-mode')) return
    const now = Date.now()
    if (now - state.lastTap < 350) document.body.classList.remove('cinema-mode')
    state.lastTap = now
  })

  document.addEventListener('dblclick', () => {
    if (document.body.classList.contains('cinema-mode')) document.body.classList.remove('cinema-mode')
  })

  wrapper.addEventListener('mousemove', e => {
    const pos = getCursorPos(e, mainCanvas)
    cursor.x = pos.x; cursor.y = pos.y; cursor.active = true
  })
  wrapper.addEventListener('mouseleave', () => {
    cursor.x = -9999; cursor.y = -9999; cursor.active = false
  })
  wrapper.addEventListener('touchmove', e => {
    if (!activeModes.has('blow')) return
    e.preventDefault()
    const pos = getCursorPos(e, mainCanvas)
    cursor.x = pos.x; cursor.y = pos.y; cursor.active = true
  }, { passive: false })
  wrapper.addEventListener('touchend', () => {
    cursor.x = -9999; cursor.y = -9999; cursor.active = false
  })
}

function getCursorPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
  const rect   = canvas.getBoundingClientRect()
  const scaleX = canvas.width  / rect.width
  const scaleY = canvas.height / rect.height
  const src    = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : (e as MouseEvent)
  return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY }
}
