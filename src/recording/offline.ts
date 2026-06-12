import { state, recState, importCdn, mainCanvas, glitchCanvas, recCanvas, recCtx, recBtn, recBadge, dlBtn, convertTipEl, durInput } from '../state'
import { buildParticles } from '../core/particles'
import { renderSingleFrame, startAnim, stopAnim } from '../core/renderer'

export async function startOfflineRecording(): Promise<void> {
  const fps = 60
  const durationSecs = Math.max(1, parseFloat(durInput.value) || 10)
  const totalFrames  = Math.round(durationSecs * fps)
  if (!recState.cropBounds) return
  const { x: ox, y: oy, w: cw, h: ch } = recState.cropBounds

  recBtn.dataset.rendering = '1'
  recBtn.classList.add('recording')
  recBtn.innerHTML = '⏳ &nbsp;0%'
  recBadge.classList.add('show')
  stopAnim()

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let MuxerCls: any, ArrBufCls: any, muxerOpts: any, encoderCodec: string, fileType: string, fileExt: string

    const avcCheck = await VideoEncoder.isConfigSupported({
      codec: 'avc1.640028', width: cw, height: ch, bitrate: 20_000_000,
    })

    if (avcCheck.supported) {
      const m = await importCdn('https://unpkg.com/mp4-muxer/build/mp4-muxer.mjs')
      MuxerCls = m['Muxer']; ArrBufCls = m['ArrayBufferTarget']
      muxerOpts = { video: { codec: 'avc', width: cw, height: ch, frameRate: fps }, fastStart: 'in-memory' }
      encoderCodec = 'avc1.640028'; fileType = 'video/mp4'; fileExt = 'mp4'
    } else {
      const m = await importCdn('https://unpkg.com/webm-muxer/build/webm-muxer.mjs')
      MuxerCls = m['Muxer']; ArrBufCls = m['ArrayBufferTarget']
      muxerOpts = { video: { codec: 'V_VP9', width: cw, height: ch, frameRate: fps } }
      encoderCodec = 'vp09.00.10.08'; fileType = 'video/webm'; fileExt = 'webm'
    }

    const target = new ArrBufCls()
    const muxer  = new MuxerCls({ target, ...muxerOpts })

    const encoder = new VideoEncoder({
      output: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => muxer.addVideoChunk(chunk, meta),
      error:  (e: Error) => console.error('VideoEncoder:', e),
    })
    encoder.configure({ codec: encoderCodec, width: cw, height: ch, bitrate: 20_000_000, framerate: fps })

    buildParticles()
    const savedFrame = state.frame
    state.frame = 0; state._pixelSortTick = 0

    for (let f = 0; f < totalFrames; f++) {
      state.frame = f + 1
      renderSingleFrame()

      recCtx.clearRect(0, 0, cw, ch)
      recCtx.drawImage(mainCanvas, ox, oy, cw, ch, 0, 0, cw, ch)
      recCtx.globalCompositeOperation = 'screen'
      recCtx.drawImage(glitchCanvas, ox, oy, cw, ch, 0, 0, cw, ch)
      recCtx.globalCompositeOperation = 'source-over'

      const vf = new VideoFrame(recCanvas, {
        timestamp: Math.round(f * 1_000_000 / fps),
        duration:  Math.round(1_000_000 / fps),
      })
      encoder.encode(vf, { keyFrame: f % (fps * 2) === 0 })
      vf.close()

      if (f % 20 === 0) {
        recBtn.innerHTML = '⏳ &nbsp;' + Math.round(f / totalFrames * 100) + '%'
        await new Promise<void>(r => setTimeout(r, 0))
      }
    }

    await encoder.flush()
    muxer.finalize()

    const blob = new Blob([target.buffer], { type: fileType })
    recState.lastBlobUrl = URL.createObjectURL(blob)
    dlBtn.dataset.url = recState.lastBlobUrl
    dlBtn.dataset.ext = fileExt
    dlBtn.innerHTML = '⬇ &nbsp;DOWNLOAD ' + fileExt.toUpperCase()
    dlBtn.style.display = ''
    if (fileExt !== 'mp4') convertTipEl.style.display = ''

    state.frame = savedFrame
    startAnim()

  } catch (err) {
    console.error('Offline render failed:', err)
  }

  recBtn.innerHTML = '⏺ &nbsp;RECORD VIDEO'
  recBtn.classList.remove('recording')
  recBadge.classList.remove('show')
  delete recBtn.dataset.rendering
}
