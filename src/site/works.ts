import './shell'
import { WORKS, WORK_FILTERS } from './data'
import { openLightbox, tileHtml } from './lightbox'

const chips = document.getElementById('work-filters')!
const grid = document.getElementById('works-grid')!
let filter = 'all'

const visible = () => WORKS.map((w, i) => ({ w, i })).filter(({ w }) => filter === 'all' || w.tags.includes(filter)).map(({ i }) => i)

function render() {
  chips.innerHTML = WORK_FILTERS.map(f => {
    const count = f === 'all' ? WORKS.length : WORKS.filter(w => w.tags.includes(f)).length
    return `<button class="chip${f === filter ? ' is-active' : ''}" data-filter="${f}" aria-pressed="${f === filter}">${f}<span class="chip-count">${count}</span></button>`
  }).join('')
  grid.innerHTML = visible().map(tileHtml).join('')
}

chips.addEventListener('click', e => {
  const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-filter]')
  if (!chip) return
  filter = chip.dataset.filter!
  render()
})

grid.addEventListener('click', e => {
  const tile = (e.target as HTMLElement).closest<HTMLElement>('[data-work]')
  if (tile) openLightbox(Number(tile.dataset.work), visible())
})

render()
