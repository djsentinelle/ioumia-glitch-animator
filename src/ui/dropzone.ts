import { state, settings, renderPane, dropZone, fileInput, wrapper, controls, zoomBar } from '../state'
import { applyResolution } from '../core/particles'
import { setZoom } from './zoom'
import { pickBlendForDrawing } from './backgrounds'
import { showTimeline } from './timeline'
import { decodeGif, closeGif, mayBeAnimated } from '../core/gif'

/** Resolves once the drawing is on screen. */
export function loadFile(file: File): Promise<void> {
  if (!file.type.startsWith('image/')) return Promise.reject(new Error(`${file.name} is not an image.`))
  const url = URL.createObjectURL(file)
  state.imgFile = file
  drawingSlot.textContent = file.name
  drawingError.textContent = ''
  return new Promise((resolve, reject) => {
    const gif = mayBeAnimated(file) ? decodeGif(file).catch(() => null) : Promise.resolve(null)
    state.img = new Image()
    state.img.onload = async () => {
      closeGif(state.gif)
      state.gif = await gif
      state.gifIndex = -1
      settings.resolution = 100
      ;(document.getElementById('resolutionSlider') as HTMLInputElement).value = '100'
      document.getElementById('resolutionVal')!.textContent = '100%'
      applyResolution()
      pickBlendForDrawing()
      dropZone.style.display = 'none'
      wrapper.classList.add('visible')
      controls.style.display = 'flex'
      controls.style.flexDirection = 'column'
      zoomBar.classList.add('visible')
      showTimeline(true)
      requestAnimationFrame(() => {
        const paneW    = renderPane.clientWidth  - 48
        const paneH    = renderPane.clientHeight - 48
        const displayW = wrapper.clientWidth
        const displayH = displayW * (state.img!.naturalHeight / state.img!.naturalWidth)
        setZoom(Math.min(paneW / displayW, paneH / displayH, 1))
      })
      resolve()
    }
    state.img.onerror = () => reject(new Error(`${file.name} could not be read as an image.`))
    state.img.src = url
  })
}

const drawingSlot  = document.getElementById('drawingSlot')  as HTMLButtonElement
const drawingInput = document.getElementById('drawingInput') as HTMLInputElement
const drawingError = document.getElementById('drawingError') as HTMLElement

/** Swaps the drawing, keeping backgrounds, sound and settings; the open draft takes the new one. */
function replaceFile(file: File | undefined): void {
  if (!file) return
  loadFile(file).then(
    () => document.dispatchEvent(new Event('draft:dirty')),
    err => { drawingError.textContent = err instanceof Error ? err.message : String(err) },
  )
}

/** A drawing picked by hand (not restored from a draft) starts a new draft. */
function pickFile(file: File): void {
  loadFile(file).then(() => document.dispatchEvent(new Event('drawing:new')), () => {})
}

export function initDropzone(): void {
  drawingSlot.addEventListener('click', () => drawingInput.click())
  drawingInput.addEventListener('change', () => { replaceFile(drawingInput.files?.[0]); drawingInput.value = '' })
  drawingSlot.addEventListener('dragover', e => { e.preventDefault(); drawingSlot.classList.add('is-dragging') })
  drawingSlot.addEventListener('dragleave', () => drawingSlot.classList.remove('is-dragging'))
  drawingSlot.addEventListener('drop', e => {
    e.preventDefault()
    drawingSlot.classList.remove('is-dragging')
    replaceFile(e.dataTransfer?.files[0])
  })

  dropZone.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', e => {
    const files = (e.target as HTMLInputElement).files
    if (files?.[0]) pickFile(files[0])
  })
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = '#c3b3ec' })
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '' })
  dropZone.addEventListener('drop', e => {
    e.preventDefault()
    dropZone.style.borderColor = ''
    const file = e.dataTransfer?.files[0]
    if (file) pickFile(file)
  })
}
