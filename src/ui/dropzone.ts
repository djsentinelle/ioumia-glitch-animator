import { state, settings, renderPane, dropZone, fileInput, wrapper, controls, zoomBar } from '../state'
import { applyResolution } from '../core/particles'
import { setZoom } from './zoom'

export function loadFile(file: File): void {
  if (!file.type.startsWith('image/')) return
  const url = URL.createObjectURL(file)
  state.img = new Image()
  state.img.onload = () => {
    settings.resolution = 100
    ;(document.getElementById('resolutionSlider') as HTMLInputElement).value = '100'
    document.getElementById('resolutionVal')!.textContent = '100%'
    applyResolution()
    dropZone.style.display = 'none'
    wrapper.classList.add('visible')
    controls.style.display      = 'flex'
    controls.style.flexDirection = 'column'
    zoomBar.classList.add('visible')
    requestAnimationFrame(() => {
      const paneW    = renderPane.clientWidth  - 48
      const paneH    = renderPane.clientHeight - 48
      const displayW = wrapper.clientWidth
      const displayH = displayW * (state.img!.naturalHeight / state.img!.naturalWidth)
      setZoom(Math.min(paneW / displayW, paneH / displayH, 1))
    })
  }
  state.img.src = url
}

export function initDropzone(): void {
  dropZone.addEventListener('click', () => fileInput.click())

  fileInput.addEventListener('change', e => {
    const files = (e.target as HTMLInputElement).files
    if (files?.[0]) loadFile(files[0])
  })

  dropZone.addEventListener('dragover', e => {
    e.preventDefault()
    dropZone.style.borderColor = '#00ffb4'
  })
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '' })
  dropZone.addEventListener('drop', e => {
    e.preventDefault()
    dropZone.style.borderColor = ''
    const file = e.dataTransfer?.files[0]
    if (file) loadFile(file)
  })
}
