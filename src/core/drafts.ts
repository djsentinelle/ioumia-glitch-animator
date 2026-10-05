// Drafts of the glitch animator, kept in this browser's IndexedDB.
// Files live in their own store, keyed by name, size and date, so autosaving a draft
// never copies a big video again; a draft only holds its settings and file keys.

export interface DraftSettings {
  /** Every slider in the settings pane, by id, in page order. */
  sliders: [string, string][]
  modes: string[]
  mirror: boolean
  pixelSort: boolean
  blend: 'source-over' | 'screen'
  duration: string
}

export interface Draft {
  id: string
  name: string
  savedAt: number
  /** A small JPEG of the drawing, as a data URL. */
  thumb: string
  files: { drawing: string; backgrounds: (string | null)[]; sound: string | null }
  settings: DraftSettings
}

const DB_NAME = 'ioumia-glitch-animator'
const DRAFTS = 'drafts'
const FILES = 'files'

let dbPromise: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1)
    open.onupgradeneeded = () => {
      open.result.createObjectStore(DRAFTS, { keyPath: 'id' })
      open.result.createObjectStore(FILES)
    }
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => reject(open.error)
  })
  return dbPromise
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function store(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return (await db()).transaction(name, mode).objectStore(name)
}

export const fileKey = (f: File): string => `${f.name}|${f.size}|${f.lastModified}|${f.type}`

/** Stores a file once; saving it again under the same key does nothing. */
export async function putFile(file: File): Promise<string> {
  const key = fileKey(file)
  const files = await store(FILES, 'readwrite')
  const existing = await request(files.count(key))
  if (!existing) await request((await store(FILES, 'readwrite')).put(file, key))
  return key
}

export async function getFile(key: string): Promise<File | null> {
  return (await request((await store(FILES, 'readonly')).get(key))) ?? null
}

export async function putDraft(draft: Draft): Promise<void> {
  await request((await store(DRAFTS, 'readwrite')).put(draft))
}

/** Newest first. */
export async function listDrafts(): Promise<Draft[]> {
  const drafts: Draft[] = await request((await store(DRAFTS, 'readonly')).getAll())
  return drafts.sort((a, b) => b.savedAt - a.savedAt)
}

export async function getDraft(id: string): Promise<Draft | null> {
  return (await request((await store(DRAFTS, 'readonly')).get(id))) ?? null
}

/** Deletes a draft and every file no other draft uses. */
export async function deleteDraft(id: string): Promise<void> {
  await request((await store(DRAFTS, 'readwrite')).delete(id))
  await collectFiles()
}

/** Removes stored files that no draft refers to any more. */
export async function collectFiles(): Promise<void> {
  const used = new Set<string>()
  for (const d of await listDrafts()) {
    used.add(d.files.drawing)
    d.files.backgrounds.forEach(k => k && used.add(k))
    if (d.files.sound) used.add(d.files.sound)
  }
  const keys = await request((await store(FILES, 'readonly')).getAllKeys())
  for (const key of keys) {
    if (!used.has(String(key))) await request((await store(FILES, 'readwrite')).delete(key))
  }
}

/** Asks the browser not to clear drafts when it runs short of space. */
export function keepStorage(): void {
  void navigator.storage?.persist?.()
}
