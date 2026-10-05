import { state, activeModes, mainCanvas, durInput, resetBtn, mirrorBtn, pixelSortBtn, dropZone } from '../state'
import { bgSettings } from '../core/backgrounds'
import { sound } from '../core/sound'
import {
  type Draft, type DraftSettings,
  putFile, getFile, putDraft, listDrafts, getDraft, deleteDraft, collectFiles, keepStorage,
} from '../core/drafts'
import { compositeFrame } from '../recording/composite'
import { loadFile } from './dropzone'
import { layerFiles, loadLayerFile, setBlend } from './backgrounds'
import { soundFile, loadSoundFile } from './sound'

// The open drawing is a draft, saved on its own a moment after every change.
// Drafts are listed on the empty screen; picking one puts everything back.

const SAVE_DELAY = 1200
const THUMB_WIDTH = 160

const list = document.getElementById('drafts') as HTMLElement
const statusEl = document.getElementById('draftStatus') as HTMLElement

let currentId: string | null = null
let restoring = false
let timer = 0
let savedFiles = ''

const setStatus = (text: string): void => { statusEl.textContent = text }
const clock = (t: number): string => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function scheduleSave(): void {
  if (!currentId || restoring) return
  clearTimeout(timer)
  setStatus('saving…')
  timer = window.setTimeout(() => { void save() }, SAVE_DELAY)
}

function snapshot(): DraftSettings {
  const sliders: [string, string][] = []
  document.querySelectorAll<HTMLInputElement>('#controls input[type="range"][id]').forEach(el => {
    // The trim and fades only mean something with a sound loaded.
    if (!sound.source && el.closest('#soundControls')) return
    sliders.push([el.id, el.value])
  })
  return {
    sliders,
    modes: [...activeModes],
    mirror: state.mirrorActive,
    pixelSort: state.pixelSortActive,
    blend: bgSettings.blend,
    duration: durInput.value,
  }
}

function thumbnail(): string {
  const w = mainCanvas.width, h = mainCanvas.height
  const scale = THUMB_WIDTH / w
  const canvas = document.createElement('canvas')
  canvas.width = THUMB_WIDTH
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)
  compositeFrame(ctx, { x: 0, y: 0, w, h })
  return canvas.toDataURL('image/jpeg', 0.7)
}

async function save(): Promise<void> {
  const id = currentId
  if (!id || !state.imgFile) return
  try {
    const files = {
      drawing: await putFile(state.imgFile),
      backgrounds: await Promise.all(layerFiles.map(f => (f ? putFile(f) : null))),
      sound: soundFile ? await putFile(soundFile) : null,
    }
    const draft: Draft = {
      id,
      name: state.imgFile.name.replace(/\.[^.]+$/, ''),
      savedAt: Date.now(),
      thumb: thumbnail(),
      files,
      settings: snapshot(),
    }
    await putDraft(draft)
    // Files swapped out since the last save are no longer needed.
    const key = JSON.stringify(files)
    if (savedFiles && key !== savedFiles) await collectFiles()
    savedFiles = key
    if (currentId === id) setStatus(`draft saved · ${clock(draft.savedAt)}`)
  } catch (err) {
    console.error('Draft save failed:', err)
    setStatus(`draft not saved: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function dispatchInput(el: HTMLInputElement, value: string): void {
  el.value = value
  try {
    el.dispatchEvent(new Event('input', { bubbles: true }))
  } catch (err) {
    console.warn('Could not restore', el.id, err)
  }
}

async function restore(id: string): Promise<void> {
  const draft = await getDraft(id)
  if (!draft) return
  restoring = true
  list.hidden = true
  try {
    const drawing = await getFile(draft.files.drawing)
    if (!drawing) throw new Error('the drawing of this draft is missing.')
    await loadFile(drawing)

    for (const [i, key] of draft.files.backgrounds.entries()) {
      const file = key && await getFile(key)
      if (file) loadLayerFile(i, file)
    }
    const audio = draft.files.sound && await getFile(draft.files.sound)
    if (audio) await loadSoundFile(audio)

    // In page order, so the sound's trim is set before its fades.
    for (const [sliderId, value] of draft.settings.sliders) {
      const el = document.getElementById(sliderId) as HTMLInputElement | null
      if (el) dispatchInput(el, value)
    }

    activeModes.clear()
    draft.settings.modes.forEach(m => activeModes.add(m))
    state.modeList = [...activeModes]
    document.querySelectorAll<HTMLElement>('.mode-btn[data-mode]').forEach(b => {
      b.classList.toggle('active', activeModes.has(b.dataset.mode!))
    })
    state.mirrorActive = draft.settings.mirror
    state.pixelSortActive = draft.settings.pixelSort
    mirrorBtn.classList.toggle('active', state.mirrorActive)
    pixelSortBtn.classList.toggle('active', state.pixelSortActive)
    setBlend(draft.settings.blend)
    dispatchInput(durInput, draft.settings.duration)

    currentId = draft.id
    savedFiles = JSON.stringify(draft.files)
    setStatus(`draft from ${new Date(draft.savedAt).toLocaleString()}`)
  } catch (err) {
    console.error('Draft restore failed:', err)
    alert('Could not open this draft: ' + (err instanceof Error ? err.message : String(err)))
  } finally {
    restoring = false
  }
}

async function renderList(): Promise<void> {
  const drafts = await listDrafts().catch(() => [] as Draft[])
  if (!drafts.length || dropZone.style.display === 'none') {
    list.hidden = true
    return
  }
  list.hidden = false
  list.innerHTML = `<div class="section-title">your drafts</div>` + drafts.map(d => `
    <div class="draft" data-id="${d.id}">
      <button type="button" class="draft-open" data-open>
        <img src="${d.thumb}" alt="">
        <span class="draft-name"></span>
        <span class="draft-date">${new Date(d.savedAt).toLocaleString()}</span>
      </button>
      <button type="button" class="draft-delete" data-delete>delete ×</button>
    </div>`).join('')
  // Names come from file names, so they go in as text.
  list.querySelectorAll<HTMLElement>('.draft').forEach((el, i) => {
    el.querySelector('.draft-name')!.textContent = drafts[i].name
  })
}

export function initDrafts(): void {
  keepStorage()

  // A drawing picked by hand starts a new draft.
  document.addEventListener('drawing:new', () => {
    // Not crypto.randomUUID: it's missing on plain http, e.g. when testing on a phone over the network.
    currentId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    savedFiles = ''
    list.hidden = true
    scheduleSave()
  })
  document.addEventListener('draft:dirty', scheduleSave)

  const pane = document.getElementById('settingsPane')!
  for (const type of ['input', 'change', 'click']) pane.addEventListener(type, scheduleSave)

  document.getElementById('draftSave')!.addEventListener('click', () => {
    clearTimeout(timer)
    void save()
  })

  // Back to the empty screen: the draft stays saved and shows up in the list.
  resetBtn.addEventListener('click', () => {
    if (currentId) { clearTimeout(timer); void save() }
    currentId = null
    setStatus('')
    setTimeout(() => { void renderList() }, 50)
  })

  list.addEventListener('click', e => {
    const target = e.target as HTMLElement
    const id = target.closest<HTMLElement>('.draft')?.dataset.id
    if (!id) return
    if (target.closest('[data-open]')) {
      void restore(id)
    } else if (target.closest('[data-delete]')) {
      const button = target.closest<HTMLButtonElement>('[data-delete]')!
      // Two clicks, so a draft isn't lost to a stray one.
      if (button.dataset.confirm) {
        void deleteDraft(id).then(renderList)
      } else {
        button.dataset.confirm = '1'
        button.textContent = 'sure? ×'
      }
    }
  })

  void renderList()
}
