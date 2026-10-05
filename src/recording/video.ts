import {
  state, recState, recCanvas, recCtx,
  recBtn, dlBtn, convertTipEl, recTimer, recTimeEl, durInput,
} from '../state'
import { startOfflineRecording } from './offline'
import { compositeFrame, recordingBounds } from './composite'

export async function startRecording(): Promise<void> {
  if (!state.img) return
  dlBtn.style.display = 'none'
  convertTipEl.style.display = 'none'
  if (recState.lastBlobUrl) { URL.revokeObjectURL(recState.lastBlobUrl); recState.lastBlobUrl = null }

  // Video encoders need even dimensions, so an odd edge loses one pixel.
  const bounds = recordingBounds()
  bounds.w = Math.max(2, bounds.w & ~1)
  bounds.h = Math.max(2, bounds.h & ~1)
  recState.cropBounds = bounds
  recCanvas.width  = bounds.w
  recCanvas.height = bounds.h

  if (typeof VideoEncoder !== 'undefined') {
    await startOfflineRecording()
    return
  }

  recState.recordedChunks = []
  const mimeType =
    MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2') ? 'video/mp4;codecs=avc1,mp4a.40.2' :
    MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')           ? 'video/mp4;codecs=avc1'           :
    MediaRecorder.isTypeSupported('video/mp4')                       ? 'video/mp4'                       :
    MediaRecorder.isTypeSupported('video/webm;codecs=vp9')           ? 'video/webm;codecs=vp9'           :
    MediaRecorder.isTypeSupported('video/webm;codecs=vp8')           ? 'video/webm;codecs=vp8'           :
    'video/webm'
  const fileExt = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'

  const stream = recCanvas.captureStream(60)
  recState.mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 20_000_000 })

  recState.mediaRecorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) recState.recordedChunks.push(e.data)
  }

  recState.mediaRecorder.onstop = () => {
    clearInterval(recState.recTimerInterval)
    recTimer.classList.remove('show')
    recBtn.classList.remove('recording')
    recBtn.innerHTML = '⏺ &nbsp;VIDEO'
    const videoBlob = new Blob(recState.recordedChunks, { type: mimeType })
    recState.lastBlobUrl = URL.createObjectURL(videoBlob)
    dlBtn.dataset.url = recState.lastBlobUrl
    dlBtn.dataset.ext = fileExt
    dlBtn.innerHTML = fileExt === 'mp4' ? '⬇ &nbsp;DOWNLOAD MP4' : '⬇ &nbsp;DOWNLOAD WEBM'
    dlBtn.style.display = ''
    if (fileExt !== 'mp4') convertTipEl.style.display = ''
  }

  recState.mediaRecorder.start(100)
  recState.recStartTime = Date.now()
  recBtn.classList.add('recording')
  recBtn.innerHTML = '■ &nbsp;STOP'
  recTimer.classList.add('show')

  const durSecs = parseFloat(durInput.value)
  if (!isNaN(durSecs) && durSecs > 0) {
    setTimeout(() => {
      if (recState.mediaRecorder && recState.mediaRecorder.state === 'recording') stopLiveRecording()
    }, durSecs * 1000)
  }

  recState.recTimerInterval = window.setInterval(() => {
    const elapsed = Math.floor((Date.now() - recState.recStartTime) / 1000)
    const m = Math.floor(elapsed / 60)
    const s = elapsed % 60
    recTimeEl.textContent = m + ':' + s.toString().padStart(2, '0')
  }, 500)

  compositeLoop()
}

export function compositeLoop(): void {
  if (!recState.mediaRecorder || recState.mediaRecorder.state !== 'recording') return
  compositeFrame(recCtx, recState.cropBounds!)
  requestAnimationFrame(compositeLoop)
}

export function stopLiveRecording(): void {
  if (recState.mediaRecorder && recState.mediaRecorder.state === 'recording') {
    recState.mediaRecorder.stop()
  }
}
