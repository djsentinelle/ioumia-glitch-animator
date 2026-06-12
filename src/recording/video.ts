import {
  state, recState,
  mainCanvas, glitchCanvas, recCanvas, recCtx,
  recBtn, dlBtn, convertTipEl, recTimer, recTimeEl, durInput,
} from '../state'
import { startOfflineRecording } from './offline'

export function getDrawingBounds(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const w = canvas.width, h = canvas.height
  const data = ctx.getImageData(0, 0, w, h).data
  let minX = w, minY = h, maxX = 0, maxY = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3
      if (data[i + 3] > 10 && brightness > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  const pad = 20
  return {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    w: Math.min(w, maxX - minX + pad * 2),
    h: Math.min(h, maxY - minY + pad * 2),
  }
}

export async function startRecording(): Promise<void> {
  if (!state.img) return
  dlBtn.style.display = 'none'
  convertTipEl.style.display = 'none'
  if (recState.lastBlobUrl) { URL.revokeObjectURL(recState.lastBlobUrl); recState.lastBlobUrl = null }

  recState.cropBounds = getDrawingBounds(mainCanvas)
  recCanvas.width  = recState.cropBounds.w
  recCanvas.height = recState.cropBounds.h

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
  const { x, y, w, h } = recState.cropBounds!
  recCtx.clearRect(0, 0, w, h)
  recCtx.drawImage(mainCanvas, x, y, w, h, 0, 0, w, h)
  recCtx.globalCompositeOperation = 'screen'
  recCtx.drawImage(glitchCanvas, x, y, w, h, 0, 0, w, h)
  recCtx.globalCompositeOperation = 'source-over'
  requestAnimationFrame(compositeLoop)
}

export function stopLiveRecording(): void {
  if (recState.mediaRecorder && recState.mediaRecorder.state === 'recording') {
    recState.mediaRecorder.stop()
  }
}
