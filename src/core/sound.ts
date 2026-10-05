import { durInput } from '../state'
import { bgLayers } from './backgrounds'

// One sound track, trimmed and faded. The processed version — exactly the timeline's
// length — is what plays live and what goes into the exported video, so both match.

export const sound = {
  source: null as AudioBuffer | null,
  name: '',
  /** Seconds into the source where the track starts and ends. */
  trimStart: 0,
  trimEnd: 0,
  fadeIn: 0,
  fadeOut: 0,
}

export const MIN_CLIP = 0.1

let context: AudioContext | null = null
let playing: AudioBufferSourceNode | null = null
let processed: AudioBuffer | null = null
let processedFor = -1

const audioContext = (): AudioContext => (context ??= new AudioContext())

/** The timeline length, in seconds: the recording duration. */
export function timelineDuration(): number {
  return Math.max(1, parseFloat(durInput.value) || 10)
}

export async function decodeSound(file: File): Promise<AudioBuffer> {
  return audioContext().decodeAudioData(await file.arrayBuffer())
}

export function setSource(buffer: AudioBuffer | null, name = ''): void {
  stopSound()
  sound.source = buffer
  sound.name = name
  sound.trimStart = 0
  sound.trimEnd = buffer?.duration ?? 0
  sound.fadeIn = 0
  sound.fadeOut = 0
  soundChanged()
}

export const clipLength = (): number => sound.trimEnd - sound.trimStart

/** Call after any change to the trim, the fades, a background's sound or the timeline length. */
export function soundChanged(): void {
  processed = null
}

/** Linear fade gain at sample `i` of a stretch `length` samples long. */
function fadeGain(i: number, length: number, fadeIn: number, fadeOut: number): number {
  let gain = 1
  if (i < fadeIn) gain = i / fadeIn
  const left = length - i
  if (left < fadeOut) gain = Math.min(gain, left / fadeOut)
  return gain
}

/**
 * Everything heard on the timeline, mixed: the trimmed, faded sound track, plus the sound of
 * any background video, looped with the video. Padded with silence or cut to the timeline's length.
 */
export function processedSound(): AudioBuffer | null {
  const src = sound.source
  const layers = bgLayers.filter(l => l.audio && l.volume > 0)
  if (!src && !layers.length) return null
  const duration = timelineDuration()
  if (processed && processedFor === duration) return processed

  // Everything is decoded by the same AudioContext, so it all shares one sample rate.
  const rate = (src ?? layers[0].audio!).sampleRate
  const channels = Math.min(2, Math.max(src?.numberOfChannels ?? 1, ...layers.map(l => l.audio!.numberOfChannels)))
  const length = Math.round(duration * rate)
  const out = new AudioBuffer({ length, numberOfChannels: channels, sampleRate: rate })
  // A mono source feeds both output channels.
  const channel = (buffer: AudioBuffer, c: number) => buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1))

  if (src) {
    const first = Math.round(sound.trimStart * rate)
    // The track ends at the trim end or the end of the timeline, whichever comes first; the fade out ends there.
    const clip = Math.min(Math.round(sound.trimEnd * rate) - first, length)
    const fadeIn = sound.fadeIn * rate
    const fadeOut = sound.fadeOut * rate
    for (let c = 0; c < channels; c++) {
      const input = channel(src, c)
      const output = out.getChannelData(c)
      for (let i = 0; i < clip; i++) output[i] += input[first + i] * fadeGain(i, clip, fadeIn, fadeOut)
    }
  }

  for (const layer of layers) {
    const audio = layer.audio!
    // Loops with the video, which restarts every `video.duration` seconds.
    const videoDuration = layer.media instanceof HTMLVideoElement && layer.media.duration ? layer.media.duration : audio.duration
    const loop = Math.max(1, Math.round(videoDuration * rate))
    const volume = layer.volume / 100
    const fadeIn = layer.fadeIn * rate
    const fadeOut = layer.fadeOut * rate
    for (let c = 0; c < channels; c++) {
      const input = channel(audio, c)
      const output = out.getChannelData(c)
      for (let i = 0; i < length; i++) {
        const j = i % loop
        if (j < input.length) output[i] += input[j] * volume * fadeGain(i, length, fadeIn, fadeOut)
      }
    }
  }

  if (layers.length) {
    for (let c = 0; c < channels; c++) {
      const output = out.getChannelData(c)
      for (let i = 0; i < length; i++) output[i] = Math.max(-1, Math.min(1, output[i]))
    }
  }
  processed = out
  processedFor = duration
  return out
}

/** Plays the processed track from `t` seconds. */
export function playSound(t: number): void {
  stopSound()
  const buffer = processedSound()
  if (!buffer || t >= buffer.duration) return
  const ctx = audioContext()
  void ctx.resume()
  playing = ctx.createBufferSource()
  playing.buffer = buffer
  playing.connect(ctx.destination)
  playing.start(0, Math.max(0, t))
}

export function stopSound(): void {
  if (!playing) return
  try { playing.stop() } catch { /* already ended */ }
  playing.disconnect()
  playing = null
}
