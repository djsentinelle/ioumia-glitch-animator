import { state } from '../state'
import { gifFrameIndex } from './gif'

/** Animation time in seconds. Frames are 1/60 s apart, live and in offline renders alike. */
export const animTime = (): number => state.frame / 60

/** The drawing as it currently shows: the image, or the current frame of an animated GIF. */
export function baseSource(): CanvasImageSource {
  return state.gif ? state.gif.frames[Math.max(0, state.gifIndex)] : state.img!
}

/** Moves an animated drawing to the frame for the current time. True when the frame changed. */
export function syncGifFrame(): boolean {
  if (!state.gif) return false
  const i = gifFrameIndex(state.gif, animTime())
  if (i === state.gifIndex) return false
  state.gifIndex = i
  return true
}
