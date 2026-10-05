import './site.css'
import { PRODUCTS } from './data'

// The bag lives in localStorage so it follows you from page to page.
const BAG_KEY = 'ioumia-bag'

function readBag(): string[] {
  try {
    const items = JSON.parse(localStorage.getItem(BAG_KEY) ?? '[]')
    return Array.isArray(items) ? items.filter(k => k in PRODUCTS) : []
  } catch {
    return []
  }
}

let bag = readBag()
const bagListeners: (() => void)[] = []

export function getBag(): readonly string[] { return bag }

export function bagTotal(): number {
  return bag.reduce((n, k) => n + PRODUCTS[k].price, 0)
}

export function onBagChange(listener: () => void) {
  bagListeners.push(listener)
  listener()
}

export function addToBag(key: string) {
  bag = [...bag, key]
  try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)) } catch { /* the bag still works for this page */ }
  bagListeners.forEach(l => l())
  say(`added ${PRODUCTS[key].name} ˚₊·`)
}

onBagChange(() => {
  document.querySelectorAll('[data-bag-count]').forEach(el => { el.textContent = String(bag.length) })
})

let toastTimer = 0

export function say(text: string) {
  let toast = document.querySelector<HTMLElement>('.toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.className = 'toast'
    toast.setAttribute('role', 'status')
    document.body.append(toast)
  }
  toast.textContent = text
  toast.hidden = false
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast!.hidden = true }, 2200)
}

/** Escapes text for use inside an HTML template. */
export function esc(text: string): string {
  return text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
}
