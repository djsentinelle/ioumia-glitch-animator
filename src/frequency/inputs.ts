import { inputs, audioPlayer } from './state'
import { showBackground } from './stage'

const AUDIO_EXT = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)$/i

// Some systems report an empty MIME type, so fall back to the extension.
const isPng = (f: File): boolean => (f.type ? f.type === 'image/png' : /\.png$/i.test(f.name))
const isAudio = (f: File): boolean => f.type.startsWith('audio/') || AUDIO_EXT.test(f.name)

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const bgSlot = el<HTMLButtonElement>('bgSlot')
const bgInput = el<HTMLInputElement>('bgInput')
const bgError = el('bgError')
const audioSlot = el<HTMLButtonElement>('audioSlot')
const audioInput = el<HTMLInputElement>('audioInput')
const audioError = el('audioError')

const BG_PROMPT = bgSlot.textContent!
const AUDIO_PROMPT = audioSlot.textContent!

function setLoaded(slot: HTMLElement, name: string | null, prompt: string): void {
  slot.textContent = name ?? prompt
  slot.classList.toggle('loaded', name !== null)
}

function loadBackground(file: File): void {
  if (!isPng(file)) {
    bgError.textContent = `${file.name} is not a PNG.`
    return
  }
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    URL.revokeObjectURL(url)
    inputs.background = img
    bgError.textContent = ''
    setLoaded(bgSlot, file.name, BG_PROMPT)
    showBackground(img)
  }
  img.onerror = () => {
    URL.revokeObjectURL(url)
    bgError.textContent = `${file.name} could not be read as an image.`
  }
  img.src = url
}

function loadAudio(file: File): void {
  if (!isAudio(file)) {
    audioError.textContent = `${file.name} is not an audio file.`
    return
  }
  if (audioPlayer.src) URL.revokeObjectURL(audioPlayer.src)
  inputs.audioFile = file
  audioError.textContent = ''
  setLoaded(audioSlot, file.name, AUDIO_PROMPT)
  audioPlayer.src = URL.createObjectURL(file)
  audioPlayer.hidden = false
}

/** Send each dropped file to the slot matching its type. */
function routeFiles(files: FileList): void {
  for (const file of files) {
    if (isPng(file)) loadBackground(file)
    else if (isAudio(file)) loadAudio(file)
    else if (file.type.startsWith('image/')) loadBackground(file) // reports "not a PNG"
    else loadAudio(file) // reports "not an audio file"
  }
}

function bindPicker(slot: HTMLElement, input: HTMLInputElement, load: (f: File) => void): void {
  slot.addEventListener('click', () => input.click())
  input.addEventListener('change', () => {
    if (input.files?.[0]) load(input.files[0])
    input.value = '' // let the same file be picked again
  })
}

export function initInputs(): void {
  bindPicker(bgSlot, bgInput, loadBackground)
  bindPicker(audioSlot, audioInput, loadAudio)

  audioPlayer.addEventListener('error', () => {
    if (!inputs.audioFile) return
    audioError.textContent = `${inputs.audioFile.name} could not be decoded by this browser.`
    inputs.audioFile = null
    setLoaded(audioSlot, null, AUDIO_PROMPT)
    audioPlayer.hidden = true
  })

  // Files can be dropped anywhere on the page.
  window.addEventListener('dragover', e => {
    e.preventDefault()
    document.body.classList.add('dragging')
  })
  window.addEventListener('dragleave', e => {
    if (!e.relatedTarget) document.body.classList.remove('dragging')
  })
  window.addEventListener('drop', e => {
    e.preventDefault()
    document.body.classList.remove('dragging')
    if (e.dataTransfer?.files.length) routeFiles(e.dataTransfer.files)
  })
}
