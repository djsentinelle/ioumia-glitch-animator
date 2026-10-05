// Encoding helpers shared by the glitch and frequency animators' MP4 exports.

export const MUXER_URL = 'https://unpkg.com/mp4-muxer@5/build/mp4-muxer.mjs'

export interface Muxer {
  addVideoChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata): void
  addAudioChunk(chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata): void
  finalize(): void
}
export interface MuxerModule {
  Muxer: new (options: object) => Muxer
  ArrayBufferTarget: new () => { buffer: ArrayBuffer }
}


// H.264 levels: [level byte, max frame size in macroblocks, max macroblocks per second].
const AVC_LEVELS = [
  [0x28, 8192, 245760], [0x2a, 8704, 522240], [0x32, 22080, 589824], [0x33, 36864, 983040],
  [0x34, 36864, 2073600], [0x3c, 139264, 4177920], [0x3d, 139264, 8355840], [0x3e, 139264, 16711680],
]

/** MP4-compatible codecs to try, most widely playable first. */
function videoCandidates(width: number, height: number, fps: number): { muxer: string; label: string; codecs: string[] }[] {
  const macroblocks = Math.ceil(width / 16) * Math.ceil(height / 16)
  const avc = AVC_LEVELS.filter(([, frame, rate]) => macroblocks <= frame && macroblocks * fps <= rate).map(
    ([level]) => `avc1.6400${level.toString(16)}`,
  )
  return [
    { muxer: 'avc', label: 'H.264', codecs: avc },
    { muxer: 'hevc', label: 'HEVC', codecs: ['hvc1.1.6.L153.B0', 'hvc1.1.6.L186.B0'] },
    { muxer: 'av1', label: 'AV1', codecs: ['av01.0.13M.08', 'av01.0.16M.08'] },
    { muxer: 'vp9', label: 'VP9', codecs: ['vp09.00.51.08', 'vp09.00.61.08'] },
  ]
}

// Chrome's software H.264 encoder silently outputs a near-empty video above about 50 Mbit/s.
const MAX_SAFE_BITRATE = 48e6

const supports = (config: VideoEncoderConfig): Promise<boolean> =>
  VideoEncoder.isConfigSupported(config).then(r => r.supported === true, () => false)

export interface PickedVideo {
  config: VideoEncoderConfig
  muxer: string
  label: string
  /** Set for constant-quality H.264: pass it with every frame (see frameOptions). */
  quantizer?: number
}

/**
 * The first codec this browser can encode at this size. Width and height must be even.
 * With a quantizer, H.264 is encoded at constant quality, taking whatever bitrate the detail needs;
 * otherwise, or where that isn't supported, at a bitrate of bitsPerPixel.
 */
export async function pickVideo(
  width: number, height: number, fps: number,
  { bitsPerPixel = 0.08, quantizer }: { bitsPerPixel?: number; quantizer?: number } = {},
): Promise<PickedVideo | null> {
  const candidates = videoCandidates(width, height, fps)
  if (quantizer !== undefined) {
    for (const codec of candidates[0].codecs) {
      const config: VideoEncoderConfig = { codec, width, height, framerate: fps, bitrateMode: 'quantizer' }
      if (await supports(config)) return { config, muxer: 'avc', label: 'H.264', quantizer }
    }
  }
  const bitrate = Math.max(8e6, Math.min(MAX_SAFE_BITRATE, Math.round(width * height * fps * bitsPerPixel)))
  for (const { muxer, label, codecs } of candidates) {
    for (const codec of codecs) {
      const config: VideoEncoderConfig = { codec, width, height, bitrate, framerate: fps }
      if (await supports(config)) return { config, muxer, label }
    }
  }
  return null
}

/** Options for VideoEncoder.encode, carrying the quantizer of a constant-quality encode. */
export function frameOptions(video: PickedVideo, keyFrame: boolean): VideoEncoderEncodeOptions {
  return video.quantizer === undefined ? { keyFrame } : { keyFrame, avc: { quantizer: video.quantizer } }
}

export async function pickAudio(sampleRate: number, numberOfChannels: number) {
  if (typeof AudioEncoder === 'undefined') return null
  for (const [codec, muxer, label] of [['mp4a.40.2', 'aac', 'AAC'], ['opus', 'opus', 'Opus']]) {
    const config: AudioEncoderConfig = { codec, sampleRate, numberOfChannels, bitrate: 192_000 }
    const supported = await AudioEncoder.isConfigSupported(config).then(r => r.supported, () => false)
    if (supported) return { config, muxer, label }
  }
  return null
}

/** Let the page repaint. Unlike setTimeout, this is not slowed down when the tab is in the background. */
export const breathe = (): Promise<void> =>
  new Promise(resolve => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => resolve()
    channel.port2.postMessage(null)
  })

/** Waits until the encoder can take more frames. Gives up waiting on an error, so a failed encoder can't hang the export. */
export async function waitForRoom(encoder: VideoEncoder, failed: () => boolean): Promise<void> {
  while (encoder.encodeQueueSize > 8 && !failed() && encoder.state === 'configured') {
    await new Promise(resolve => {
      encoder.addEventListener('dequeue', resolve, { once: true })
      setTimeout(resolve, 250)
    })
  }
}

export function encodeAudio(audio: AudioBuffer, channels: number, encoder: AudioEncoder): void {
  const chunk = audio.sampleRate // one second at a time
  for (let start = 0; start < audio.length; start += chunk) {
    const frames = Math.min(chunk, audio.length - start)
    const data = new Float32Array(frames * channels)
    for (let c = 0; c < channels; c++) data.set(audio.getChannelData(c).subarray(start, start + frames), c * frames)
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate: audio.sampleRate,
      numberOfFrames: frames,
      numberOfChannels: channels,
      timestamp: Math.round((start / audio.sampleRate) * 1e6),
      data,
    })
    encoder.encode(audioData)
    audioData.close()
  }
}
