import './shell'
import { DEMO_SOURCES, STATUS_COLOR, TOOLS, TOOL_FILTERS } from './data'
import { esc, say } from './shell'

// ── static demo ──────────────────────────────────────────────

const demo = { source: 0, scan: 0.6, glow: 0.4, hue: 0 }

const baseImg = document.getElementById('demo-base') as HTMLImageElement
const glowImg = document.getElementById('demo-glow') as HTMLImageElement
const scanEl = document.getElementById('demo-scan')!
const thumbs = document.getElementById('demo-thumbs')!

const baseFilter = (hue: number) => `hue-rotate(${hue}deg) saturate(1.15) contrast(1.05)`
const glowFilter = (hue: number, blur: number) => `blur(${blur}px) brightness(1.5) saturate(1.4) hue-rotate(${hue}deg)`

function renderDemo() {
  const src = DEMO_SOURCES[demo.source]
  baseImg.src = glowImg.src = src
  baseImg.style.filter = baseFilter(demo.hue)
  glowImg.style.filter = glowFilter(demo.hue, 7)
  glowImg.style.opacity = String(demo.glow)
  scanEl.style.opacity = String(demo.scan)
  document.getElementById('scan-value')!.textContent = `${Math.round(demo.scan * 100)}%`
  document.getElementById('glow-value')!.textContent = `${Math.round(demo.glow * 100)}%`
  document.getElementById('hue-value')!.textContent = `${demo.hue}°`
  thumbs.querySelectorAll<HTMLElement>('.thumb').forEach((t, i) => {
    t.classList.toggle('is-active', i === demo.source)
    t.setAttribute('aria-pressed', String(i === demo.source))
  })
}

thumbs.innerHTML = DEMO_SOURCES.map((src, i) =>
  `<button class="thumb" data-source="${i}" aria-label="source ${i + 1}"><img src="${src}" alt=""></button>`).join('')
thumbs.addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-source]')
  if (!t) return
  demo.source = Number(t.dataset.source)
  renderDemo()
})

for (const key of ['scan', 'glow', 'hue'] as const) {
  document.getElementById(`demo-${key}-input`)!.addEventListener('input', e => {
    demo[key] = Number((e.target as HTMLInputElement).value)
    renderDemo()
  })
}

// Redraws the four preview layers on a canvas at twice the preview size and downloads it.
const SAVE_SCALE = 2

document.getElementById('demo-save')!.addEventListener('click', () => {
  const w = 336 * SAVE_SCALE
  const h = 504 * SAVE_SCALE
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  ctx.filter = baseFilter(demo.hue)
  ctx.drawImage(baseImg, 0, 0, w, h)

  ctx.filter = glowFilter(demo.hue, 7 * SAVE_SCALE)
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = demo.glow
  ctx.drawImage(baseImg, 0, 0, w, h)

  ctx.filter = 'none'
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 0.9 * demo.scan
  ctx.fillStyle = '#000'
  for (let y = 0; y < h; y += 3 * SAVE_SCALE) ctx.fillRect(0, y, w, SAVE_SCALE)

  // Same as the CSS vignette: an ellipse reaching the corners, clear up to 55%.
  ctx.globalAlpha = 1
  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.scale(1, h / w)
  const r = (w / 2) * Math.SQRT2
  const vignette = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
  vignette.addColorStop(0.55, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,.55)')
  ctx.fillStyle = vignette
  ctx.fillRect(-w / 2, -r, w, 2 * r)
  ctx.restore()

  canvas.toBlob(blob => {
    if (!blob) return say("couldn't save this look")
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'ioumia-static.png'
    a.click()
    URL.revokeObjectURL(a.href)
    say('look saved ˚₊·')
  }, 'image/png')
})

renderDemo()

// ── all tools ────────────────────────────────────────────────

const chips = document.getElementById('tool-filters')!
const grid = document.getElementById('tools-grid')!
let filter = 'all'

function renderTools() {
  chips.innerHTML = TOOL_FILTERS.map(([key, label]) => {
    const count = key === 'all' ? TOOLS.length : TOOLS.filter(t => t.type === key).length
    return `<button class="chip${key === filter ? ' is-active' : ''}" data-filter="${key}" aria-pressed="${key === filter}">${label}<span class="chip-count">${count}</span></button>`
  }).join('')

  grid.innerHTML = TOOLS.filter(t => filter === 'all' || t.type === filter).map(t => `
    <article class="tool-card">
      <div class="tool-thumb">
        <img src="${t.thumb}" alt="" style="object-position:${t.pos}" loading="lazy">
        <span class="status"><span class="dot" style="color:${STATUS_COLOR[t.status]}"></span>${t.status}</span>
      </div>
      <div class="tool-body">
        <div class="tool-title"><h3>${esc(t.name)}</h3><span class="tool-type">${t.type}</span></div>
        <p class="tool-desc">${esc(t.desc)}</p>
        ${t.href
          ? `<a class="tool-cta link-pixel" href="${t.href}">open tool →</a>`
          : `<a class="tool-cta link-pixel" href="#demo">try it above ↑</a>`}
      </div>
    </article>`).join('')
}

chips.addEventListener('click', e => {
  const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-filter]')
  if (!chip) return
  filter = chip.dataset.filter!
  renderTools()
})

renderTools()
