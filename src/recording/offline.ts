import {
  state, recState, importCdn, recCanvas, recCtx,
  recBtn, recBadge, dlBtn, convertTipEl,
} from '../state'
import { renderSingleFrame, startAnim, stopAnim } from '../core/renderer'
import { buildParticles } from '../core/particles'
import { hasVideo, seekVideos } from '../core/backgrounds'
import { processedSound, timelineDuration } from '../core/sound'
import { compositeFrame } from './composite'
import { MUXER_URL, type MuxerModule, pickVideo, pickAudio, breathe, encodeAudio, waitForRoom } from './encoding'

const FPS = 60

/** Renders the whole timeline frame by frame, with its sound, into an MP4. */
export async function startOfflineRecording(): Promise<void> {
  const totalFrames = Math.round(timelineDuration() * FPS)
  const bounds = recState.cropBounds!
  const { w: cw, h: ch } = bounds

  recBtn.dataset.rendering = '1'
  recBtn.classList.add('recording')
  recBtn.innerHTML = '⏳ &nbsp;0%'
  recBadge.classList.add('show')

  stopAnim()
  const savedFrame = state.frame

  try {
    // Picked for the actual frame size: a fixed H.264 level can't encode large frames.
    const video = await pickVideo(cw, ch, FPS)
    if (!video) throw new Error(`This browser cannot encode ${cw}×${ch} video.`)
    const audio = processedSound()
    const sound = audio && await pickAudio(audio.sampleRate, audio.numberOfChannels)

    const { Muxer, ArrayBufferTarget } = (await importCdn(MUXER_URL)) as unknown as MuxerModule
    const target = new ArrayBufferTarget()
    const muxer = new Muxer({
      target,
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
      video: { codec: video.muxer, width: cw, height: ch, frameRate: FPS },
      ...(audio && sound && { audio: { codec: sound.muxer, numberOfChannels: audio.numberOfChannels, sampleRate: audio.sampleRate } }),
    })

    // Surfaced so the loop stops instead of waiting on a dead encoder.
    let failure: Error | null = null
    const onError = (e: Error) => { failure = e; console.error('Encoder:', e) }

    if (audio && sound) {
      const audioEncoder = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: onError })
      audioEncoder.configure(sound.config)
      encodeAudio(audio, audio.numberOfChannels, audioEncoder)
      await audioEncoder.flush()
      audioEncoder.close()
    }

    const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: onError })
    encoder.configure(video.config)

    buildParticles()
    state._pixelSortTick = 0
    // Background videos are stepped to each frame's time so they stay in sync with the render.
    const withVideo = hasVideo()

    for (let f = 0; f < totalFrames && !failure; f++) {
      if (withVideo) await seekVideos(f / FPS)
      state.frame = f
      renderSingleFrame()
      compositeFrame(recCtx, bounds)

      const vf = new VideoFrame(recCanvas, {
        timestamp: Math.round(f * 1_000_000 / FPS),
        duration:  Math.round(1_000_000 / FPS),
      })
      encoder.encode(vf, { keyFrame: f % (FPS * 2) === 0 })
      vf.close()

      // Do not render faster than the encoder can take frames.
      await waitForRoom(encoder, () => !!failure)
      if (f % 10 === 0) {
        recBtn.innerHTML = '⏳ &nbsp;' + Math.round(f / totalFrames * 100) + '%'
        await breathe()
      }
    }

    if (failure) throw failure
    await encoder.flush()
    encoder.close()
    if (failure) throw failure
    muxer.finalize()

    const blob = new Blob([target.buffer], { type: 'video/mp4' })
    recState.lastBlobUrl = URL.createObjectURL(blob)
    dlBtn.dataset.url = recState.lastBlobUrl
    dlBtn.dataset.ext = 'mp4'
    dlBtn.innerHTML = '⬇ &nbsp;DOWNLOAD MP4' + (audio && !sound ? ' (no sound)' : '')
    dlBtn.style.display = ''
    convertTipEl.style.display = 'none'
  } catch (err) {
    console.warn('Offline render failed:', err)
    alert('Recording failed: ' + (err instanceof Error ? err.message : String(err)))
  }

  state.frame = savedFrame
  startAnim()
  recBtn.innerHTML = '⏺ &nbsp;RECORD VIDEO'
  recBtn.classList.remove('recording')
  recBadge.classList.remove('show')
  delete recBtn.dataset.rendering
}
