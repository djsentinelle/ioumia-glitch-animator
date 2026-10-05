import { timelineDuration, playSound, stopSound } from './sound'
import { syncVideos } from './backgrounds'

// While playing, time comes from the real clock rather than from counting frames,
// so the sound stays in sync whatever the screen's refresh rate. It loops over the timeline.

let startedAt = 0

/** Starts the clock (and the sound) at `t` seconds. */
export function startClock(t: number): void {
  startedAt = performance.now() - t * 1000
  playSound(t)
  syncVideos(t)
}

/** Moves the clock to `t` without sound, for scrubbing while playing. */
export function moveClock(t: number): void {
  startedAt = performance.now() - t * 1000
  stopSound()
  syncVideos(t)
}

export function stopClock(): void {
  stopSound()
}

/** Seconds into the timeline. Wrapping past the end restarts the sound from the top. */
export function clockTime(): number {
  const duration = timelineDuration()
  let t = (performance.now() - startedAt) / 1000
  if (t >= duration) {
    const loops = Math.floor(t / duration)
    startedAt += loops * duration * 1000
    t -= loops * duration
    playSound(t)
    syncVideos(t)
  }
  return t
}
