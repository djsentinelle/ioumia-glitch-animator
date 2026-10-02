import { audioPlayer, type FreqRange } from './state'

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
      analyser.fftSize = 8192
      analyser.smoothingTimeConstant = 0.8
      analyser.minDecibels = -85
      analyser.maxDecibels = -25
      context.createMediaElementSource(audioPlayer).connect(analyser).connect(context.destination)
      bins = new Uint8Array(analyser.frequencyBinCount)
      binHz = context.sampleRate / analyser.fftSize
    }
    void context.resume()
  })
}

/** Fill `out` with one 0..1 level per band. Bands are log-spaced across `range`, lowest first. */
export function readLevels(out: Float32Array, range: FreqRange): void {
  if (!analyser) {
    out.fill(0)
    return
  }
  analyser.getByteFrequencyData(bins)
  const n = out.length
  const ratio = range.max / range.min
  const last = bins.length - 1
  for (let i = 0; i < n; i++) {
    const f0 = range.min * ratio ** (i / n)
    const f1 = range.min * ratio ** ((i + 1) / n)
    const k0 = Math.min(last, Math.floor(f0 / binHz))
    const k1 = Math.min(last, Math.max(k0, Math.ceil(f1 / binHz) - 1))
    let peak = 0
    for (let k = k0; k <= k1; k++) if (bins[k] > peak) peak = bins[k]
    out[i] = peak / 255
  }
}
