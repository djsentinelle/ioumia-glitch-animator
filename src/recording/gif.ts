import {
  state, recState,
  mainCanvas, glitchCanvas,
  gifBtn, dlGifBtn, recTimer, durInput,
} from '../state'
import { startAnim } from '../core/renderer'

export function startGif(): void {
  if (!state.img) return
  if (!state.isPlaying) startAnim()
  if (!recState.cropBounds) {
    recState.cropBounds = { x: 0, y: 0, w: mainCanvas.width, h: mainCanvas.height }
  }
  recState.gifRecording = true
  recState.gifFrames = []
  dlGifBtn.style.display = 'none'
  gifBtn.classList.add('recording')
  gifBtn.innerHTML = '■ &nbsp;STOP GIF'
  recTimer.classList.add('show')

  recState.gifInterval = window.setInterval(() => {
    const cb = recState.cropBounds ?? { x: 0, y: 0, w: mainCanvas.width, h: mainCanvas.height }
    const gc = document.createElement('canvas')
    gc.width = cb.w; gc.height = cb.h
    const gx = gc.getContext('2d')!
    gx.drawImage(mainCanvas, cb.x, cb.y, cb.w, cb.h, 0, 0, cb.w, cb.h)
    gx.globalCompositeOperation = 'screen'
    gx.drawImage(glitchCanvas, cb.x, cb.y, cb.w, cb.h, 0, 0, cb.w, cb.h)
    recState.gifFrames.push(gc.toDataURL('image/png'))
  }, 33)

  const durSecs = parseFloat(durInput.value)
  if (!isNaN(durSecs) && durSecs > 0) {
    recState.gifAutoStop = window.setTimeout(stopGif, durSecs * 1000)
  }
}

export function stopGif(): void {
  clearInterval(recState.gifInterval)
  clearTimeout(recState.gifAutoStop)
  recState.gifRecording = false
  gifBtn.classList.remove('recording')
  gifBtn.innerHTML = '⏺ &nbsp;GIF'
  recTimer.classList.remove('show')
  if (recState.gifFrames.length === 0) return
  buildGif(recState.gifFrames)
}

export function buildGif(frames: string[]): void {
  gifBtn.innerHTML = '⏳ Building GIF...'
  ;(gifBtn as HTMLButtonElement).disabled = true

  const script = document.createElement('script')
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js'
  script.onerror = () => { gifBtn.innerHTML = '⏺ &nbsp;GIF'; (gifBtn as HTMLButtonElement).disabled = false }
  script.onload = () => {
    const cb = recState.cropBounds ?? { w: mainCanvas.width, h: mainCanvas.height }
    const gif = new GIF({
      workers: 2, quality: 1,
      width: cb.w, height: cb.h,
      workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
    })
    let loaded = 0
    frames.forEach(src => {
      const img = new Image()
      img.onload = () => {
        const fc = document.createElement('canvas')
        fc.width = mainCanvas.width; fc.height = mainCanvas.height
        fc.getContext('2d')!.drawImage(img, 0, 0)
        gif.addFrame(fc, { delay: 33 })
        loaded++
        if (loaded === frames.length) gif.render()
      }
      img.src = src
    })
    gif.on('finished', (blob: Blob) => {
      const url = URL.createObjectURL(blob)
      dlGifBtn.dataset.url = url
      dlGifBtn.style.display = ''
      gifBtn.innerHTML = '⏺ &nbsp;GIF'
      ;(gifBtn as HTMLButtonElement).disabled = false
    })
  }
  document.head.appendChild(script)
}
