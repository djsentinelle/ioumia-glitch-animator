import { state, recState, mainCanvas, glitchCanvas, gifBtn, dlGifBtn, recTimer, durInput } from '../state'
import { startAnim } from '../core/renderer'
import { getDrawingBounds } from './video'

export function startGif(): void {
  if (!state.img) return
  if (!state.isPlaying) startAnim()
  if (!recState.cropBounds) recState.cropBounds = getDrawingBounds(mainCanvas)

  recState.gifRecording = true
  recState.gifFrames    = []
  dlGifBtn.style.display = 'none'
  gifBtn.classList.add('recording')
  gifBtn.innerHTML = '■ &nbsp;STOP GIF'
  recTimer.classList.add('show')

  recState.gifInterval = setInterval(() => {
    const cb = recState.cropBounds ?? { x: 0, y: 0, w: mainCanvas.width, h: mainCanvas.height }
    const gc = document.createElement('canvas')
    gc.width  = cb.w
    gc.height = cb.h
    const gx = gc.getContext('2d')!
    gx.drawImage(mainCanvas, cb.x, cb.y, cb.w, cb.h, 0, 0, cb.w, cb.h)
    gx.globalCompositeOperation = 'screen'
    gx.drawImage(glitchCanvas, cb.x, cb.y, cb.w, cb.h, 0, 0, cb.w, cb.h)
    recState.gifFrames.push(gc.toDataURL('image/png'))
  }, 33)

  const durSecs = parseFloat(durInput.value)
  if (!isNaN(durSecs) && durSecs > 0) recState.gifAutoStop = setTimeout(stopGif, durSecs * 1000)
}

export function stopGif(): void {
  if (recState.gifInterval) { clearInterval(recState.gifInterval); recState.gifInterval = null }
  if (recState.gifAutoStop) { clearTimeout(recState.gifAutoStop);  recState.gifAutoStop  = null }
  recState.gifRecording = false
  gifBtn.classList.remove('recording')
  gifBtn.innerHTML = '⏺ &nbsp;GIF'
  recTimer.classList.remove('show')
  if (recState.gifFrames.length === 0) return
  buildGif(recState.gifFrames)
}

export function buildGif(frames: string[]): void {
  gifBtn.innerHTML = '⏳ Building GIF...'
  gifBtn.disabled  = true

  const script    = document.createElement('script')
  script.src      = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js'
  script.onerror  = () => {
    console.error('Failed to load gif.js')
    gifBtn.innerHTML = '⏺ &nbsp;GIF'
    gifBtn.disabled  = false
  }
  script.onload = () => {
    const cb  = recState.cropBounds ?? { w: mainCanvas.width, h: mainCanvas.height }
    const gif = new GIF({
      workers: 2, quality: 1, width: cb.w, height: cb.h,
      workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
    })
    let loaded = 0
    frames.forEach(src => {
      const frameImg     = new Image()
      frameImg.onload    = () => {
        const fc = document.createElement('canvas')
        fc.width = mainCanvas.width; fc.height = mainCanvas.height
        fc.getContext('2d')!.drawImage(frameImg, 0, 0)
        gif.addFrame(fc, { delay: 33 })
        loaded++
        if (loaded === frames.length) gif.render()
      }
      frameImg.src = src
    })
    gif.on('finished', blob => {
      const url = URL.createObjectURL(blob)
      dlGifBtn.dataset.url  = url
      dlGifBtn.style.display = ''
      gifBtn.innerHTML = '⏺ &nbsp;GIF'
      gifBtn.disabled  = false
    })
  }
  document.head.appendChild(script)
}
