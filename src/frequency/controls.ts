import { settings, spectrum, FULL_RANGE, type Axis, type FreqRange } from './state'

const axisButtons: Record<Axis, HTMLButtonElement> = {
  x: document.getElementById('axisXBtn') as HTMLButtonElement,
  y: document.getElementById('axisYBtn') as HTMLButtonElement,
}
const invertBtn = document.getElementById('invertBtn') as HTMLButtonElement
const directionLabel = document.getElementById('directionLabel') as HTMLElement
const bandsSlider = document.getElementById('bandsSlider') as HTMLInputElement
const bandsVal = document.getElementById('bandsVal') as HTMLElement
const rangeDual = document.getElementById('rangeDual') as HTMLElement
const rangeMin = document.getElementById('rangeMinSlider') as HTMLInputElement
const rangeMax = document.getElementById('rangeMaxSlider') as HTMLInputElement
const rangeLabel = document.getElementById('rangeLabel') as HTMLElement
const autoRangeBtn = document.getElementById('autoRangeBtn') as HTMLButtonElement

// The range slider is logarithmic: equal travel per octave from 20 Hz to 20 kHz.
const STEPS = 1000
const MIN_GAP = 30 // about a third of an octave
const SPAN = FULL_RANGE.max / FULL_RANGE.min
const toStep = (hz: number): number => Math.round((STEPS * Math.log(hz / FULL_RANGE.min)) / Math.log(SPAN))
const toHz = (step: number): number => FULL_RANGE.min * SPAN ** (step / STEPS)
const formatHz = (f: number): string => (f < 1000 ? `${Math.round(f)} Hz` : `${(f / 1000).toFixed(1)} kHz`)

/** Apply a frequency range to the display and move the slider to match. */
export function showRange(range: FreqRange, pending = false): void {
  spectrum.range = range
  rangeMin.value = String(toStep(range.min))
  rangeMax.value = String(toStep(range.max))
  paintRange(pending)
}

function paintRange(pending = false): void {
  rangeDual.style.setProperty('--lo', String(Number(rangeMin.value) / STEPS))
  rangeDual.style.setProperty('--hi', String(Number(rangeMax.value) / STEPS))
  const { min, max } = spectrum.range
  rangeLabel.textContent = pending ? 'analysing…' : `${formatHz(min)} – ${formatHz(max)}`
}

/** A handle moved: keep the two apart, then read the range back from the slider. */
function onRangeInput(moved: HTMLInputElement): void {
  const lo = Number(rangeMin.value)
  const hi = Number(rangeMax.value)
  if (hi - lo < MIN_GAP) {
    if (moved === rangeMin) rangeMin.value = String(hi - MIN_GAP)
    else rangeMax.value = String(lo + MIN_GAP)
  }
  spectrum.range = { min: toHz(Number(rangeMin.value)), max: toHz(Number(rangeMax.value)) }
  paintRange()
}

function refresh(): void {
  axisButtons.x.classList.toggle('active', settings.axis === 'x')
  axisButtons.y.classList.toggle('active', settings.axis === 'y')
  invertBtn.classList.toggle('active', settings.invert)
  const ends = settings.axis === 'x' ? ['left', 'right'] : ['bottom', 'top']
  if (settings.invert) ends.reverse()
  directionLabel.textContent = `low ${ends[0]} → high ${ends[1]}`
}

export function initControls(): void {
  for (const axis of ['x', 'y'] as const) {
    axisButtons[axis].addEventListener('click', () => {
      settings.axis = axis
      refresh()
    })
  }
  invertBtn.addEventListener('click', () => {
    settings.invert = !settings.invert
    refresh()
  })
  bandsSlider.addEventListener('input', () => {
    settings.bands = Number(bandsSlider.value)
    bandsVal.textContent = bandsSlider.value
  })
  rangeMin.addEventListener('input', () => onRangeInput(rangeMin))
  rangeMax.addEventListener('input', () => onRangeInput(rangeMax))
  autoRangeBtn.addEventListener('click', () => showRange(spectrum.detected))
  showRange(spectrum.range)
  refresh()
}
