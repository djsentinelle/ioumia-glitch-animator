import { WORKS, pad } from './data'
import { esc } from './shell'

// Shows one work full size. ← → step through `order`, the works currently on screen.
let order: number[] = []
let current = -1
let box: HTMLElement | null = null

function build(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'lightbox'
  el.hidden = true
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-modal', 'true')
  el.addEventListener('click', e => {
    const target = e.target as HTMLElement
    if (target === el || target.closest('[data-lb="close"]')) close()
    else if (target.closest('[data-lb="prev"]')) step(-1)
    else if (target.closest('[data-lb="next"]')) step(1)
  })
  document.body.append(el)
  window.addEventListener('keydown', e => {
    if (current < 0) return
    if (e.key === 'Escape') close()
    if (e.key === 'ArrowRight') step(1)
    if (e.key === 'ArrowLeft') step(-1)
  })
  return el
}

function render() {
  const w = WORKS[current]
  box!.setAttribute('aria-label', w.title)
  box!.innerHTML = `
    <div class="lightbox-body">
      <img class="lightbox-img" src="${w.src}" alt="${esc(w.title)}">
      <div class="lightbox-info">
        <span class="lightbox-num">${pad(current + 1)} / ${pad(WORKS.length)}</span>
        <h2 class="lightbox-title">${esc(w.title)}</h2>
        <span class="lightbox-tags">digital painting · ${esc(w.tags.join(' · '))}</span>
        <div class="btn-row">
          <button class="btn btn-ghost" data-lb="prev">← prev</button>
          <button class="btn btn-ghost" data-lb="next">next →</button>
        </div>
        <a class="link-pixel" href="/merch/">get it as a print →</a>
        <span class="lightbox-hint">esc to close · ← → to browse</span>
      </div>
    </div>
    <button class="lightbox-close" data-lb="close">close ×</button>`
}

function step(d: number) {
  const list = order.includes(current) ? order : WORKS.map((_, i) => i)
  const pos = list.indexOf(current)
  current = list[(pos + d + list.length) % list.length]
  render()
}

function close() {
  current = -1
  box!.hidden = true
  document.body.style.overflow = ''
}

export function openLightbox(index: number, visible: number[]) {
  box ??= build()
  order = visible
  current = index
  render()
  box.hidden = false
  document.body.style.overflow = 'hidden'
  box.querySelector<HTMLElement>('[data-lb="close"]')?.focus()
}

/** Markup for an artwork tile. Clicks are wired by the page through data-work. */
export function tileHtml(i: number): string {
  const w = WORKS[i]
  return `<button class="tile" data-work="${i}">
    <img src="${w.src}" alt="${esc(w.title)}" loading="lazy">
    <span class="tile-cap"><span class="tile-num">${pad(i + 1)}</span><span class="tile-title">${esc(w.title)}</span></span>
  </button>`
}
