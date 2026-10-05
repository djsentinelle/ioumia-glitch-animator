export type Axis = 'x' | 'y'
export interface FreqRange { min: number; max: number }

/** The audible range, used until a file has been scanned. */
export const FULL_RANGE: FreqRange = { min: 20, max: 20000 }

/** The two files the user supplies. Null until loaded. */
export const inputs: {
  background: HTMLImageElement | null
  audioFile: File | null
  /** The decoded samples of `audioFile`, once decoding has finished. */
  audioBuffer: AudioBuffer | null
} = {
  background: null,
  audioFile: null,
  audioBuffer: null,
}

/** `range` is spread across the image. `detected` is what the scan of the audio file found. */
export const spectrum: { range: FreqRange; detected: FreqRange } = { range: FULL_RANGE, detected: FULL_RANGE }

export const settings: { axis: Axis; invert: boolean; bands: number } = {
  axis: 'x', // frequencies run along the width (x) or the height (y)
  invert: false,
  bands: 48,
}

export type FxKey = 'blur' | 'noise' | 'glitch' | 'aberration' | 'hue' | 'bloom'

/** Band effects, each from 0 (off) to 10, except hue: a shift of 0 to 360 degrees around the colour wheel. */
export const fx: Record<FxKey, number> = { blur: 4, noise: 3, glitch: 4, aberration: 2, hue: 0, bloom: 0 }

export const audioPlayer = document.getElementById('audioPlayer') as HTMLAudioElement
