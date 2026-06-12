import { initZoom }        from './zoom'
import { initDropzone }    from './dropzone'
import { initSliders }     from './sliders'
import { initControls }    from './controls'
import { initRecordingUI } from '../recording'

export function initUI(): void {
  initZoom()
  initDropzone()
  initSliders()
  initControls()
  initRecordingUI()
}
