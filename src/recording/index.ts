import { recState, recBtn, dlBtn, gifBtn, dlGifBtn } from '../state'
import { startRecording, stopLiveRecording } from './video'
import { startGif, stopGif } from './gif'

export function initRecordingUI(): void {
  recBtn.addEventListener('click', () => {
    if (recBtn.dataset.rendering) return
    if (recState.mediaRecorder && recState.mediaRecorder.state === 'recording') {
      stopLiveRecording()
    } else {
      startRecording()
    }
  })

  dlBtn.addEventListener('click', () => {
    if (!dlBtn.dataset.url) return
    const a      = document.createElement('a')
    a.href       = dlBtn.dataset.url
    a.download   = 'glitch-animation.' + (dlBtn.dataset.ext ?? 'mp4')
    a.click()
  })

  gifBtn.addEventListener('click', () => {
    if (recState.gifRecording) stopGif(); else startGif()
  })

  dlGifBtn.addEventListener('click', () => {
    if (!dlGifBtn.dataset.url) return
    const a    = document.createElement('a')
    a.href     = dlGifBtn.dataset.url
    a.download = 'glitch-animation.gif'
    a.click()
  })
}
