// Animated images — GIF, and APNG or WebP, which keep full colour and transparency — decoded
// once into frames so they can be drawn at any point in time. Drawing an <img> of one onto a
// canvas only ever gives its first frame.

export interface GifAnim {
  frames: ImageBitmap[]
  /** When each frame starts, in seconds. */
  starts: number[]
  duration: number
  width: number
  height: number
}

/** Image types that can be animated. */
const ANIMATABLE = ['image/gif', 'image/png', 'image/apng', 'image/webp']

export const mayBeAnimated = (file: File): boolean => ANIMATABLE.includes(file.type)

/** GIFs with no delay play at 10 fps in browsers. */
const DEFAULT_DELAY = 0.1

export const canDecodeGif = (): boolean => typeof ImageDecoder !== 'undefined'

/** Returns null for a still image, or when this browser can't decode the animation. */
export async function decodeGif(file: File): Promise<GifAnim | null> {
  if (!canDecodeGif() || !mayBeAnimated(file)) return null
  // A .png that turns out to be an APNG still reports image/png; the decoder handles both.
  const type = file.type === 'image/apng' ? 'image/png' : file.type
  if (!(await ImageDecoder.isTypeSupported(type))) return null
  const decoder = new ImageDecoder({ data: await file.arrayBuffer(), type })
  try {
    await decoder.tracks.ready
    const count = decoder.tracks.selectedTrack?.frameCount ?? 1
    if (count < 2) return null
    const frames: ImageBitmap[] = []
    const starts: number[] = []
    let time = 0
    for (let i = 0; i < count; i++) {
      const { image } = await decoder.decode({ frameIndex: i })
      starts.push(time)
      time += image.duration ? image.duration / 1_000_000 : DEFAULT_DELAY
      frames.push(await createImageBitmap(image))
      image.close()
    }
    return { frames, starts, duration: time, width: frames[0].width, height: frames[0].height }
  } finally {
    decoder.close()
  }
}

/** Index of the frame showing at `seconds`, looping. */
export function gifFrameIndex(anim: GifAnim, seconds: number): number {
  const t = seconds % anim.duration
  let lo = 0, hi = anim.starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (anim.starts[mid] <= t) lo = mid; else hi = mid - 1
  }
  return lo
}

export function closeGif(anim: GifAnim | null): void {
  anim?.frames.forEach(f => f.close())
}
