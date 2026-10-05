// Site content. Titles, tags and prices are placeholders from the design handoff.

export interface Work { src: string; title: string; tags: string[] }

export const WORKS: Work[] = [
  { src: '/site/w1.png', title: 'veil', tags: ['underwater'] },
  { src: '/site/w2.png', title: 'many eyes', tags: ['eyes'] },
  { src: '/site/w3.png', title: 'white peonies', tags: ['monochrome'] },
  { src: '/site/w4.png', title: 'bubble', tags: ['underwater'] },
  { src: '/site/w5.png', title: 'the watchers', tags: ['monochrome', 'eyes'] },
  { src: '/site/w6.png', title: 'kelp hair', tags: ['underwater'] },
  { src: '/site/w7.png', title: 'clover eyes', tags: ['eyes'] },
  { src: '/site/w8.png', title: 'jellyfish crown', tags: ['underwater', 'eyes'] },
  { src: '/site/w9.png', title: 'aquarium', tags: ['underwater'] },
  { src: '/site/w10.png', title: 'blue static', tags: ['underwater'] },
  { src: '/site/w11.png', title: 'halo', tags: ['monochrome'] },
  { src: '/site/w12.png', title: 'violet eyes', tags: ['monochrome', 'eyes'] },
]

export const WORK_FILTERS = ['all', 'underwater', 'monochrome', 'eyes']

export type ToolStatus = 'live' | 'beta' | 'soon'

export interface Tool {
  id: string
  name: string
  type: 'web tool' | 'filter'
  status: ToolStatus
  thumb: string
  pos: string
  short: string
  desc: string
  /** Opens the tool. Without it, the card scrolls to the demo on the factory page. */
  href?: string
}

export const TOOLS: Tool[] = [
  {
    id: 'glitch', name: 'glitch animator', type: 'web tool', status: 'live',
    thumb: '/site/tool-glitch.jpg', pos: '24% 46%', href: '/factory/glitch/',
    short: 'your drawing breaks into pixels that drift, rain and spark.',
    desc: 'load a drawing and every pixel comes alive: sparkle, drift, pulse, rain, explode, rgb split. record it as a video or a gif.',
  },
  {
    id: 'frequency', name: 'frequency animator', type: 'web tool', status: 'live',
    thumb: '/site/w9.png', pos: 'center 30%', href: '/factory/frequency/',
    short: 'a song turned into glowing bands over your background.',
    desc: 'drop in a background and a song, and its frequencies glow across it as bands. blur, noise, glitch, hue and bloom, then export a full-size mp4.',
  },
  {
    id: 'static', name: 'static', type: 'filter', status: 'live',
    thumb: '/site/w12.png', pos: 'center 35%',
    short: 'scanlines, soft glow and a slow drift of color.',
    desc: 'the crt filter i use on almost everything: scanlines, soft glow and a slow drift of color.',
  },
]

export const TOOL_FILTERS: [string, string][] = [['all', 'all'], ['web tool', 'web tools'], ['filter', 'filters']]

export const STATUS_COLOR: Record<ToolStatus, string> = { live: '#8cc7bf', beta: '#c3b3ec', soon: '#6f8682' }

export const PRODUCTS: Record<string, { name: string; price: number }> = {
  print: { name: 'many eyes print', price: 22 },
  stickers: { name: 'the watchers stickers', price: 6 },
  keychain: { name: 'jellyfish keychain', price: 12 },
  postcards: { name: 'underwater postcards', price: 10 },
  tote: { name: 'aquarium tote', price: 24 },
}

export const DEMO_SOURCES = ['/site/w12.png', '/site/w1.png', '/site/w8.png', '/site/w3.png']

export const pad = (n: number) => String(n).padStart(2, '0')
