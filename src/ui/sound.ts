import { state, durInput } from '../state'
import { sound, MIN_CLIP, clipLength, decodeSound, setSource, soundChanged, playSound } from '../core/sound'
import { redrawTimeline, formatTime } from './timeline'

const STEPS = 1000

/** The sound's file, kept for drafts. */
export let soundFile: File | null = null
const PROMPT = 'tap or drop an audio file'

const slot = document.getElementById('soundSlot') as HTMLButtonElement
const input = document.getElementById('soundInput') as HTMLInputElement
const errorEl = document.getElementById('soundError') as HTMLElement
const panel = document.getElementById('soundControls') as HTMLElement
const trimDual = document.getElementById('trimDual') as HTMLElement
const trimStart = document.getElementById('trimStart') as HTMLInputElement
const trimEnd = document.getElementById('trimEnd') as HTMLInputElement
const trimLabel = document.getElementById('trimLabel') as HTMLElement
const fadeIn = document.getElementById('fadeIn') as HTMLInputElement
const fadeOut = document.getElementById('fadeOut') as HTMLInputElement

/** After any change to what's heard: redraw the waveform and let a playing sound pick it up. */
export function soundEdited(): void {
  soundChanged()
  redrawTimeline()
  if (state.isPlaying) playSound(state.frame / 60)
}

/** After an edit to the sound track; fitDuration makes the timeline take the clip's length. */
function afterChange(fitDuration: boolean): void {
  if (fitDuration) durInput.value = clipLength().toFixed(1)
  soundEdited()
}

function syncTrim(): void {
  const length = sound.source?.duration ?? 1
  trimStart.value = String(Math.round((sound.trimStart / length) * STEPS))
  trimEnd.value = String(Math.round((sound.trimEnd / length) * STEPS))
  trimDual.style.setProperty('--lo', String(Number(trimStart.value) / STEPS))
  trimDual.style.setProperty('--hi', String(Number(trimEnd.value) / STEPS))
  trimLabel.textContent = `${formatTime(sound.trimStart)} – ${formatTime(sound.trimEnd)} · ${formatTime(clipLength())}`
}

function syncFades(): void {
  // A fade can't be longer than the clip.
  const max = Math.max(0, Math.floor(clipLength() * 10) / 10)
  fadeIn.max = fadeOut.max = String(Math.min(10, max))
  sound.fadeIn = Math.min(sound.fadeIn, Number(fadeIn.max))
  sound.fadeOut = Math.min(sound.fadeOut, Number(fadeOut.max))
  fadeIn.value = String(sound.fadeIn)
  fadeOut.value = String(sound.fadeOut)
  document.getElementById('fadeInVal')!.textContent = `${sound.fadeIn.toFixed(1)}s`
  document.getElementById('fadeOutVal')!.textContent = `${sound.fadeOut.toFixed(1)}s`
}

function showSound(): void {
  slot.textContent = sound.name || PROMPT
  slot.classList.toggle('loaded', !!sound.source)
  panel.hidden = !sound.source
  if (sound.source) { syncTrim(); syncFades() }
}

export async function loadSoundFile(file: File | undefined): Promise<void> {
  if (!file) return
  errorEl.textContent = ''
  if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
    errorEl.textContent = `${file.name} is not an audio file.`
    return
  }
  slot.textContent = 'loading…'
  try {
    setSource(await decodeSound(file), file.name)
    soundFile = file
  } catch {
    setSource(null)
    soundFile = null
    errorEl.textContent = `${file.name} could not be decoded by this browser.`
  }
  showSound()
  afterChange(!!sound.source)
  document.dispatchEvent(new Event('draft:dirty'))
}

function onTrim(edge: 'start' | 'end'): void {
  const length = sound.source!.duration
  let start = (Number(trimStart.value) / STEPS) * length
  let end = (Number(trimEnd.value) / STEPS) * length
  // Keep at least MIN_CLIP between the handles, moving the one being dragged.
  if (end - start < MIN_CLIP) {
    if (edge === 'start') start = Math.max(0, end - MIN_CLIP)
    else end = Math.min(length, start + MIN_CLIP)
  }
  sound.trimStart = start
  sound.trimEnd = end
  syncTrim()
  syncFades()
  afterChange(true)
}

export function initSound(): void {
  slot.addEventListener('click', () => input.click())
  input.addEventListener('change', () => { void loadSoundFile(input.files?.[0]); input.value = '' })
  slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('is-dragging') })
  slot.addEventListener('dragleave', () => slot.classList.remove('is-dragging'))
  slot.addEventListener('drop', e => {
    e.preventDefault()
    slot.classList.remove('is-dragging')
    void loadSoundFile(e.dataTransfer?.files[0])
  })

  trimStart.addEventListener('input', () => onTrim('start'))
  trimEnd.addEventListener('input', () => onTrim('end'))

  fadeIn.addEventListener('input', () => { sound.fadeIn = Number(fadeIn.value); syncFades(); afterChange(false) })
  fadeOut.addEventListener('input', () => { sound.fadeOut = Number(fadeOut.value); syncFades(); afterChange(false) })

  document.getElementById('soundRemove')!.addEventListener('click', () => {
    setSource(null)
    soundFile = null
    showSound()
    afterChange(false)
  })

  // The duration is the timeline's length; the sound is cut or padded to it.
  durInput.addEventListener('input', () => afterChange(false))
}
