import '../style.css'
import './frequency.css'
import { initInputs } from './inputs'
import { initControls } from './controls'
import { initAudio } from './audio'
import { startRenderer } from './renderer'
import { initExport } from './export'

initInputs()
initControls()
initAudio()
startRenderer()
initExport()
