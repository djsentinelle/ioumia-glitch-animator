import { inputs, settings, spectrum, audioPlayer } from './state'
import { canvas } from './stage'
import { createOfflineAnalyser } from './audio'
import { drawFrame, setLive } from './renderer'
import { MUXER_URL, type MuxerModule, pickVideo, pickAudio, breathe, encodeAudio, waitForRoom } from '../recording/encoding'

const FPS = 60
const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement
const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement
const statusEl = document.getElementById('exportStatus') as HTMLElement
const EXPORT_LABEL = exportBtn.textContent!

let running = false
let cancelled = false
let downloadUrl: string | null = null

/** Render the whole track frame by frame at the background's native size. Returns null if cancelled. */
async function render(audio: AudioBuffer): Promise<{ blob: Blob; summary: string } | null> {
  // H.264 needs even dimensions, so an odd edge loses one pixel.
  const width = canvas.width & ~1
  const height = canvas.height & ~1

  const video = await pickVideo(width, height, FPS)
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
    await waitForRoom(videoEncoder, () => !!failure)
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
