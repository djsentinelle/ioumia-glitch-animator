import { state, renderPane, zoomContainer, zoomLabelEl } from '../state'

export function setZoom(z: number): void {
  state.zoomLevel = Math.min(4, Math.max(0.25, z))
  zoomContainer.style.transform = `scale(${state.zoomLevel})`
  zoomLabelEl.textContent = Math.round(state.zoomLevel * 100) + '%'
  const naturalW = zoomContainer.scrollWidth / state.zoomLevel
  const naturalH = zoomContainer.scrollHeight / state.zoomLevel
  zoomContainer.style.marginBottom = (naturalH * (state.zoomLevel - 1)) + 'px'
  zoomContainer.style.marginRight  = (naturalW * (state.zoomLevel - 1) / 2) + 'px'
}

export function initZoom(): void {
  document.getElementById('zoomIn')!.addEventListener('click',    () => setZoom(state.zoomLevel + 0.25))
  document.getElementById('zoomOut')!.addEventListener('click',   () => setZoom(state.zoomLevel - 0.25))
  document.getElementById('zoomReset')!.addEventListener('click', () => setZoom(1))

  renderPane.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    setZoom(state.zoomLevel - e.deltaY * 0.002)
  }, { passive: false })
}
