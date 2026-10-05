import './shell'
import { TOOLS } from './data'
import { esc } from './shell'
import { openLightbox, tileHtml } from './lightbox'

const LATEST = [0, 1, 2, 3]

const latest = document.getElementById('latest')!
latest.innerHTML = LATEST.map(tileHtml).join('')
latest.addEventListener('click', e => {
  const tile = (e.target as HTMLElement).closest<HTMLElement>('[data-work]')
  if (tile) openLightbox(Number(tile.dataset.work), LATEST)
})

document.getElementById('teasers')!.innerHTML = TOOLS.map(t => `
  <a class="teaser" href="${t.href ?? '/factory/#demo'}">
    <img src="${t.thumb}" alt="" style="object-position:${t.pos}">
    <span class="teaser-text">
      <span class="teaser-name">${esc(t.name)}</span>
      <span class="teaser-short">${esc(t.short)}</span>
    </span>
  </a>`).join('')
