import { createFile, DataStream, Endianness, MP4BoxBuffer, type Sample } from 'mp4box'

// Background videos for exports, decoded in order with WebCodecs. Seeking a <video> to every
// frame costs 70–350 ms a frame on a large video, which made long exports look stuck;
// decoding straight through runs at about real time or faster.
// Only MP4 and MOV can be read this way; other videos fall back to seeking.

export interface FrameSource {
  /** The frame showing at `seconds` on a video that loops every `loop` seconds. */
  frameAt(seconds: number, loop: number): Promise<VideoFrame | null>
  close(): void
}

/** The codec configuration box (avcC, hvcC…) the decoder needs, without its 8-byte header. */
function description(file: ReturnType<typeof createFile>, trackId: number): Uint8Array | undefined {
  // The box types are loose in mp4box's typings, hence the cast.
  const entries = (file.getTrackById(trackId) as any).mdia.minf.stbl.stsd.entries
  for (const entry of entries) {
    const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C
    if (box) {
      const stream = new DataStream(undefined, 0, Endianness.BIG_ENDIAN)
      box.write(stream)
      return new Uint8Array(stream.buffer, 8)
    }
  }
  return undefined
}

async function demux(file: File): Promise<{ config: VideoDecoderConfig; samples: Sample[] } | null> {
  const mp4 = createFile()
  const samples: Sample[] = []
  let config: VideoDecoderConfig | null = null
  let trackId = -1

  mp4.onReady = info => {
    const track = info.videoTracks[0]
    if (!track) return
    trackId = track.id
    config = {
      codec: track.codec.startsWith('vp08') ? 'vp8' : track.codec,
      codedWidth: track.video!.width,
      codedHeight: track.video!.height,
      description: description(mp4, track.id),
    }
    mp4.setExtractionOptions(track.id, null, { nbSamples: Infinity })
    mp4.start()
  }
  mp4.onSamples = (id, _user, batch) => { if (id === trackId) samples.push(...batch) }

  mp4.appendBuffer(MP4BoxBuffer.fromArrayBuffer(await file.arrayBuffer(), 0))
  mp4.flush()
  if (!config || !samples.length) return null
  const supported = await VideoDecoder.isConfigSupported(config).then(r => r.supported, () => false)
  return supported ? { config, samples } : null
}

/** Null when the file can't be decoded this way; the caller then seeks the <video> instead. */
export async function openFrameSource(file: File): Promise<FrameSource | null> {
  if (typeof VideoDecoder === 'undefined') return null
  const demuxed = await demux(file).catch(() => null)
  if (!demuxed) return null
  const { config, samples } = demuxed

  const ready: VideoFrame[] = []
  let failed = false
  let wake: (() => void) | null = null
  const decoder = new VideoDecoder({
    output: f => { ready.push(f); wake?.() },
    error: () => { failed = true; wake?.() },
  })
  let next = 0
  let flushed = false
  let current: VideoFrame | null = null
  let upcoming: VideoFrame | null = null
  /** current is still the video's first frame, so a time before it isn't a loop back. */
  let atStart = true

  const restart = (): void => {
    ready.forEach(f => f.close())
    ready.length = 0
    current?.close(); current = null
    upcoming?.close(); upcoming = null
    if (decoder.state === 'configured') decoder.reset()
    decoder.configure(config)
    next = 0
    flushed = false
    atStart = true
  }

  /** The next frame in display order, or null at the end of the video. */
  const nextFrame = async (): Promise<VideoFrame | null> => {
    while (!ready.length && !failed) {
      if (next < samples.length) {
        // Keep a few samples in flight; B-frames need some before the first frame comes out.
        while (next < samples.length && decoder.decodeQueueSize < 8) {
          const s = samples[next++]
          decoder.decode(new EncodedVideoChunk({
            type: s.is_sync ? 'key' : 'delta',
            timestamp: Math.round((s.cts * 1e6) / s.timescale),
            duration: Math.round((s.duration * 1e6) / s.timescale),
            data: s.data!,
          }))
        }
      } else if (!flushed) {
        flushed = true
        await decoder.flush()
        continue
      } else {
        return null
      }
      await new Promise<void>(resolve => { wake = resolve; setTimeout(resolve, 20) })
      wake = null
    }
    return ready.shift() ?? null
  }

  restart()

  return {
    async frameAt(seconds, loop) {
      if (failed) return current
      const target = (loop > 0 ? seconds % loop : seconds) * 1e6
      // Looped back to the start: decode again from the top.
      if (current && !atStart && target < current.timestamp) restart()
      current ??= await nextFrame()
      while (current) {
        upcoming ??= await nextFrame()
        if (!upcoming || upcoming.timestamp > target) break
        current.close()
        current = upcoming
        upcoming = null
        atStart = false
      }
      return current
    },
    close() {
      ready.forEach(f => f.close())
      current?.close()
      upcoming?.close()
      if (decoder.state !== 'closed') decoder.close()
    },
  }
}
