import { fft } from './fft'
import { audioPlayer, type FreqRange } from './state'

// Shared by the live analyser and its offline twin, so an export matches the preview.
const FFT_SIZE = 8192
const SMOOTHING = 0.8
const MIN_DB = -85
const MAX_DB = -25

let context: AudioContext | null = null
let analyser: AnalyserNode | null = null
let bins = new Uint8Array(0)
let binHz = 0

/** Route the audio player through an analyser. Browsers only allow this after a user gesture, hence on play. */
export function initAudio(): void {
  audioPlayer.addEventListener('play', () => {
    if (!context) {
      context = new AudioContext()
      analyser = context.createAnalyser()
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = SMOOTHING
      analyser.minDecibels = MIN_DB
      analyser.maxDecibels = MAX_DB
      context.createMediaElementSource(audioPlayer).connect(analyser).connect(context.destination)
      bins = new Uint8Array(analyser.frequencyBinCount)
      binHz = context.sampleRate / analyser.fftSize
    }
    void context.resume()
  })
}

/** Fill `out` with one 0..1 level per band, from the audio currently playing. */
export function readLevels(out: Float32Array, range: FreqRange): void {
  if (!analyser) {
    out.fill(0)
    return
  }
  analyser.getByteFrequencyData(bins)
  bandLevels(bins, binHz, out, range)
}

/** Reduce a 0..255 spectrum to one 0..1 level per band. Bands are log-spaced across `range`, lowest first. */
function bandLevels(spectrum: ArrayLike<number>, hzPerBin: number, out: Float32Array, range: FreqRange): void {
  const n = out.length
  const ratio = range.max / range.min
  const last = spectrum.length - 1
  for (let i = 0; i < n; i++) {
    const f0 = range.min * ratio ** (i / n)
    const f1 = range.min * ratio ** ((i + 1) / n)
    const k0 = Math.min(last, Math.floor(f0 / hzPerBin))
    const k1 = Math.min(last, Math.max(k0, Math.ceil(f1 / hzPerBin) - 1))
    let peak = 0
    for (let k = k0; k <= k1; k++) if (spectrum[k] > peak) peak = spectrum[k]
    out[i] = peak / 255
  }
}

/**
 * The live analyser, reproduced on decoded audio: same window, smoothing and decibel scale
 * as the Web Audio AnalyserNode. Call the returned function once per video frame, in order.
 */
export function createOfflineAnalyser(audio: AudioBuffer): (time: number, out: Float32Array, range: FreqRange) => void {
  const channels: Float32Array[] = []
  for (let c = 0; c < audio.numberOfChannels; c++) channels.push(audio.getChannelData(c))

  const blackman = new Float32Array(FFT_SIZE)
  for (let i = 0; i < FFT_SIZE; i++) {
    const a = (2 * Math.PI * i) / FFT_SIZE
    blackman[i] = 0.42 - 0.5 * Math.cos(a) + 0.08 * Math.cos(2 * a)
  }

  const half = FFT_SIZE / 2
  const re = new Float32Array(FFT_SIZE)
  const im = new Float32Array(FFT_SIZE)
  const smoothed = new Float32Array(half)
  const spectrum = new Float32Array(half)
  const hzPerBin = audio.sampleRate / FFT_SIZE

  return (time, out, range) => {
    // The analyser sees the samples leading up to the current time.
    const end = Math.round(time * audio.sampleRate)
    for (let i = 0; i < FFT_SIZE; i++) {
      const at = end - FFT_SIZE + i
      let sample = 0
      if (at >= 0 && at < audio.length) {
        for (const channel of channels) sample += channel[at]
        sample /= channels.length
      }
      re[i] = sample * blackman[i]
      im[i] = 0
    }
    fft(re, im)
    for (let k = 0; k < half; k++) {
      const magnitude = Math.hypot(re[k], im[k]) / FFT_SIZE
      smoothed[k] = SMOOTHING * smoothed[k] + (1 - SMOOTHING) * magnitude
      const db = 20 * Math.log10(smoothed[k])
      spectrum[k] = Math.max(0, Math.min(255, (255 * (db - MIN_DB)) / (MAX_DB - MIN_DB)))
    }
    bandLevels(spectrum, hzPerBin, out, range)
  }
}
