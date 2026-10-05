import { inputs, settings, spectrum, audioPlayer } from './state'
import { canvas } from './stage'
import { createOfflineAnalyser } from './audio'
import { drawFrame, setLive } from './renderer'

const FPS = 60
const BITS_PER_PIXEL = 0.08
const MUXER_URL = 'https://unpkg.com/mp4-muxer@5/build/mp4-muxer.mjs'

const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement
const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement
const statusEl = document.getElementById('exportStatus') as HTMLElement
const EXPORT_LABEL = exportBtn.textContent!

interface Muxer {
  addVideoChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata): void
  addAudioChunk(chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata): void
  finalize(): void
}
interface MuxerModule {
  Muxer: new (options: object) => Muxer
  ArrayBufferTarget: new () => { buffer: ArrayBuffer }
}

let running = false
let cancelled = false
let downloadUrl: string | null = null

// H.264 levels: [level byte, max frame size in macroblocks, max macroblocks per second].
const AVC_LEVELS = [
  [0x28, 8192, 245760], [0x2a, 8704, 522240], [0x32, 22080, 589824], [0x33, 36864, 983040],
  [0x34, 36864, 2073600], [0x3c, 139264, 4177920], [0x3d, 139264, 8355840], [0x3e, 139264, 16711680],
]

/** MP4-compatible codecs to try, most widely playable first. */
function videoCandidates(width: number, height: number): { muxer: string; label: string; codecs: string[] }[] {
  const macroblocks = Math.ceil(width / 16) * Math.ceil(height / 16)
  const avc = AVC_LEVELS.filter(([, frame, rate]) => macroblocks <= frame && macroblocks * FPS <= rate).map(
    ([level]) => `avc1.6400${level.toString(16)}`,
  )
  return [
    { muxer: 'avc', label: 'H.264', codecs: avc },
    { muxer: 'hevc', label: 'HEVC', codecs: ['hvc1.1.6.L153.B0', 'hvc1.1.6.L186.B0'] },
    { muxer: 'av1', label: 'AV1', codecs: ['av01.0.13M.08', 'av01.0.16M.08'] },
    { muxer: 'vp9', label: 'VP9', codecs: ['vp09.00.51.08', 'vp09.00.61.08'] },
  ]
}

async function pickVideo(width: number, height: number) {
  const bitrate = Math.max(8e6, Math.min(40e6, Math.round(width * height * FPS * BITS_PER_PIXEL)))
  for (const { muxer, label, codecs } of videoCandidates(width, height)) {
    for (const codec of codecs) {
      const config: VideoEncoderConfig = { codec, width, height, bitrate, framerate: FPS }
      const supported = await VideoEncoder.isConfigSupported(config).then(r => r.supported, () => false)
      if (supported) return { config, muxer, label }
    }
  }
  return null
}

async function pickAudio(sampleRate: number, numberOfChannels: number) {
  if (typeof AudioEncoder === 'undefined') return null
  for (const [codec, muxer, label] of [['mp4a.40.2', 'aac', 'AAC'], ['opus', 'opus', 'Opus']]) {
    const config: AudioEncoderConfig = { codec, sampleRate, numberOfChannels, bitrate: 192_000 }
    const supported = await AudioEncoder.isConfigSupported(config).then(r => r.supported, () => false)
    if (supported) return { config, muxer, label }
  }
  return null
}

/** Let the page repaint. Unlike setTimeout, this is not slowed down when the tab is in the background. */
const breathe = (): Promise<void> =>
  new Promise(resolve => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => resolve()
    channel.port2.postMessage(null)
  })

function encodeAudio(audio: AudioBuffer, channels: number, encoder: AudioEncoder): void {
  const chunk = audio.sampleRate // one second at a time
  for (let start = 0; start < audio.length; start += chunk) {
    const frames = Math.min(chunk, audio.length - start)
    const data = new Float32Array(frames * channels)
    for (let c = 0; c < channels; c++) data.set(audio.getChannelData(c).subarray(start, start + frames), c * frames)
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate: audio.sampleRate,
      numberOfFrames: frames,
      numberOfChannels: channels,
      timestamp: Math.round((start / audio.sampleRate) * 1e6),
      data,
    })
    encoder.encode(audioData)
    audioData.close()
  }
}

/** Render the whole track frame by frame at the background's native size. Returns null if cancelled. */
async function render(audio: AudioBuffer): Promise<{ blob: Blob; summary: string } | null> {
  // H.264 needs even dimensions, so an odd edge loses one pixel.
  const width = canvas.width & ~1
  const height = canvas.height & ~1

  const video = await pickVideo(width, height)
  if (!video) throw new Error(`This browser cannot encode ${width}×${height} video.`)
  const channels = Math.min(2, audio.numberOfChannels)
  const sound = await pickAudio(audio.sampleRate, channels)

  const { Muxer, ArrayBufferTarget } = (await import(/* @vite-ignore */ MUXER_URL)) as MuxerModule
  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
    video: { codec: video.muxer, width, height, frameRate: FPS },
    ...(sound && { audio: { codec: sound.muxer, numberOfChannels: channels, sampleRate: audio.sampleRate } }),
  })

  let failure: Error | null = null
  const onError = (e: Error): void => { failure = e }

  if (sound) {
    const audioEncoder = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: onError })
    audioEncoder.configure(sound.config)
    encodeAudio(audio, channels, audioEncoder)
    await audioEncoder.flush()
    audioEncoder.close()
  }

  const videoEncoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: onError })
  videoEncoder.configure(video.config)

  const analyse = createOfflineAnalyser(audio)
  const levels = new Float32Array(settings.bands)
  const totalFrames = Math.ceil(audio.duration * FPS)

  for (let f = 0; f < totalFrames && !cancelled && !failure; f++) {
    analyse(f / FPS, levels, spectrum.range)
    drawFrame(levels)
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round((f * 1e6) / FPS),
      duration: Math.round(1e6 / FPS),
      visibleRect: { x: 0, y: 0, width, height },
    })
    videoEncoder.encode(frame, { keyFrame: f % (FPS * 2) === 0 })
    frame.close()

    // Do not render faster than the encoder can take frames.
    while (videoEncoder.encodeQueueSize > 8 && !failure) {
      await new Promise(resolve => videoEncoder.addEventListener('dequeue', resolve, { once: true }))
    }
    if (f % 10 === 0) {
      exportBtn.textContent = `■ Cancel · ${Math.round((f / totalFrames) * 100)}%`
      await breathe()
    }
  }

  if (failure) throw failure
  if (cancelled) {
    videoEncoder.close()
    return null
  }
  await videoEncoder.flush()
  videoEncoder.close()
  if (failure) throw failure
  muxer.finalize()

  const blob = new Blob([target.buffer], { type: 'video/mp4' })
  const megabytes = (blob.size / 1e6).toFixed(blob.size < 1e7 ? 1 : 0)
  const summary = `${width}×${height} · ${FPS} fps · ${video.label}${sound ? ` + ${sound.label}` : ' · no audio'} · ${megabytes} MB`
  return { blob, summary }
}

async function startExport(): Promise<void> {
  const audio = inputs.audioBuffer
  if (!inputs.background || !audio) {
    statusEl.textContent = 'Load a background and an audio file first.'
    return
  }
  if (typeof VideoEncoder === 'undefined') {
    statusEl.textContent = 'This browser cannot encode video. Use Chrome or Edge.'
    return
  }

  running = true
  cancelled = false
  downloadBtn.hidden = true
  if (downloadUrl) URL.revokeObjectURL(downloadUrl)
  downloadUrl = null
  statusEl.textContent = 'Rendering. Settings changed now apply to the frames still to come.'
  exportBtn.classList.add('recording')
  exportBtn.textContent = '■ Cancel · 0%'
  audioPlayer.pause()
  setLive(false)

  try {
    const result = await render(audio)
    if (result) {
      downloadUrl = URL.createObjectURL(result.blob)
      downloadBtn.hidden = false
      statusEl.textContent = result.summary
    } else {
      statusEl.textContent = 'Export cancelled.'
    }
  } catch (err) {
    console.error('Export failed:', err)
    statusEl.textContent = `Export failed: ${err instanceof Error ? err.message : String(err)}`
  }

  running = false
  setLive(true)
  exportBtn.classList.remove('recording')
  exportBtn.textContent = EXPORT_LABEL
}

export function initExport(): void {
  exportBtn.addEventListener('click', () => {
    if (running) cancelled = true
    else void startExport()
  })
  downloadBtn.addEventListener('click', () => {
    if (!downloadUrl) return
    const link = document.createElement('a')
    link.href = downloadUrl
    const track = inputs.audioFile?.name.replace(/\.[^.]+$/, '') ?? 'frequency-animation'
    link.download = `${track}.mp4`
    link.click()
  })
}
