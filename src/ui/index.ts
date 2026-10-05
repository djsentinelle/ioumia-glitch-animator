import { initZoom }        from './zoom'
import { initDropzone }    from './dropzone'
import { initSliders }     from './sliders'
import { initControls }    from './controls'
import { initRecordingUI } from '../recording'
import { initBackgrounds } from './backgrounds'
import { initTimeline } from './timeline'
import { initSound } from './sound'
import { initDrafts } from './drafts'

export function initUI(): void {
  initZoom()
  initDropzone()
  initSliders()
  initControls()
  initRecordingUI()
  // After initSliders, which wires the .fx-expand toggles already in the page.
  initBackgrounds()
  initTimeline()
  initSound()
  initDrafts()
}
