/** The two files the user supplies. Null until loaded. */
export const inputs: { background: HTMLImageElement | null; audioFile: File | null } = {
  background: null,
  audioFile: null,
}

export const audioPlayer = document.getElementById('audioPlayer') as HTMLAudioElement
