import { fft } from './fft'
import { FULL_RANGE, type FreqRange } from './state'

const FFT_SIZE = 8192
const MAX_FRAMES = 300
/**
 * A frequency counts as "played" if its loudest moment is within this of the file's loudest one.
 * Matches roughly what the renderer shows: quieter frequencies never light a visible band.
 */
const FLOOR_DB = -30

/**
 * Scan the whole file and return the frequency range it actually uses,
 * so the display can spread that range over the full image.
 */
export async function detectRange(file: File): Promise<FreqRange> {
  const decoder = new OfflineAudioContext(1, 1, 44100)
  const audio = await decoder.decodeAudioData(await file.arrayBuffer())
  if (audio.length < FFT_SIZE) return FULL_RANGE

  const channels: Float32Array[] = []
  for (let c = 0; c < audio.numberOfChannels; c++) channels.push(audio.getChannelData(c))

  const hann = new Float32Array(FFT_SIZE)
  for (let i = 0; i < FFT_SIZE; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1))

  // Keep each frequency's loudest moment, over frames spread evenly across the file.
  const frames = Math.min(MAX_FRAMES, Math.floor(audio.length / FFT_SIZE))
  const step = frames > 1 ? (audio.length - FFT_SIZE) / (frames - 1) : 0
  const half = FFT_SIZE / 2
  const power = new Float64Array(half)
  const re = new Float32Array(FFT_SIZE)
  const im = new Float32Array(FFT_SIZE)

  for (let f = 0; f < frames; f++) {
    const start = Math.round(f * step)
    for (let i = 0; i < FFT_SIZE; i++) {
      let sample = 0
      for (const channel of channels) sample += channel[start + i]
      re[i] = (sample / channels.length) * hann[i]
      im[i] = 0
    }
    fft(re, im)
    for (let k = 1; k < half; k++) {
      const p = re[k] * re[k] + im[k] * im[k]
      if (p > power[k]) power[k] = p
    }
  }

  let peak = 0
  for (let k = 1; k < half; k++) if (power[k] > peak) peak = power[k]
  if (peak === 0) return FULL_RANGE // silent file

  const threshold = peak * 10 ** (FLOOR_DB / 10)
  let lo = 1
  while (lo < half - 1 && power[lo] < threshold) lo++
  let hi = half - 1
  while (hi > lo && power[hi] < threshold) hi--

  const binHz = audio.sampleRate / FFT_SIZE
  let min = Math.max(FULL_RANGE.min, lo * binHz)
  let max = Math.min(FULL_RANGE.max, (hi + 1) * binHz)

  // A near-pure tone gives a sliver of a range. Widen it to one octave around its centre.
  if (max < min * 2) {
    const centre = Math.sqrt(min * max)
    min = Math.max(FULL_RANGE.min, centre / Math.SQRT2)
    max = Math.min(FULL_RANGE.max, centre * Math.SQRT2)
  }
  return { min, max }
}
