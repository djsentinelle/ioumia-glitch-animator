import { settings, tint, fx } from '../state'
import { buildParticles, applyResolution } from '../core/particles'

export function initSliders(): void {
  bindSlider('sizeSlider',    'sizeVal',    'size')
  bindSlider('glitchSlider',  'glitchVal',  'glitch')
  bindSlider('densitySlider', 'densityVal', 'density')

  ;(document.getElementById('resolutionSlider') as HTMLInputElement).addEventListener('input', function () {
    settings.resolution = parseInt(this.value)
    document.getElementById('resolutionVal')!.textContent = this.value + '%'
    applyResolution()
  })

  bindFxSlider('sparkleSlider',      'sparkleVal',      'sparkle', 'radius')
  bindFxSlider('sparkleSpeedSlider', 'sparkleSpeedVal', 'sparkle', 'speed')
  bindFxSlider('driftAmpSlider',     'driftAmpVal',     'drift',   'amp')
  bindFxSlider('driftSpeedSlider',   'driftSpeedVal',   'drift',   'speed')
  bindFxSlider('pulseScaleSlider',   'pulseScaleVal',   'pulse',   'scale')
  bindFxSlider('pulseSpeedSlider',   'pulseSpeedVal',   'pulse',   'speed')
  bindFxSlider('rainSpeedSlider',    'rainSpeedVal',    'rain',    'speed')
  bindFxSlider('rainOpacitySlider',  'rainOpacityVal',  'rain',    'opacity')
  bindFxSlider('rainTrailSlider',    'rainTrailVal',    'rain',    'trail')
  bindFxSlider('rainFadeSlider',     'rainFadeVal',     'rain',    'fade')
  bindFxSlider('explodeForceSlider', 'explodeForceVal', 'explode', 'force')
  bindFxSlider('explodeSpeedSlider', 'explodeSpeedVal', 'explode', 'speed')
  bindFxSlider('rgbSpreadSlider',    'rgbSpreadVal',    'rgb',     'spread')
  bindFxSlider('rgbSpeedSlider',     'rgbSpeedVal',     'rgb',     'speed')
  bindFxSlider('blowForceSlider',    'blowForceVal',    'blow',    'force')
  bindFxSlider('blowRadiusSlider',   'blowRadiusVal',   'blow',    'radius')
  bindFxSlider('blowChaosSlider',    'blowChaosVal',    'blow',    'chaos')

  ;(['r', 'g', 'b'] as const).forEach(ch => {
    const slider = document.getElementById(ch + 'Slider') as HTMLInputElement
    const valEl  = document.getElementById(ch + 'Val')!
    slider.addEventListener('input', () => {
      tint[ch] = parseInt(slider.value)
      valEl.textContent = slider.value
    })
  })

  document.querySelectorAll('.fx-expand').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = (btn as HTMLElement).dataset.target
      if (!target) return
      document.getElementById(target)?.classList.toggle('open')
      btn.classList.toggle('open')
    })
  })
}

function bindSlider(id: string, valId: string, key: string): void {
  const slider = document.getElementById(id) as HTMLInputElement
  const valEl  = document.getElementById(valId)!
  slider.addEventListener('input', () => {
    settings[key] = parseInt(slider.value)
    valEl.textContent = slider.value
    if (key === 'intensity' || key === 'size' || key === 'density') buildParticles()
  })
}

function bindFxSlider(id: string, valId: string, effect: string, key: string): void {
  const el  = document.getElementById(id) as HTMLInputElement | null
  const val = document.getElementById(valId)
  if (!el || !val) return
  el.addEventListener('input', () => {
    fx[effect][key] = parseFloat(el.value)
    val.textContent = el.value
    if (key === 'density') buildParticles()
  })
}
