export type SoundType = 'bell' | 'chime' | 'soft'

const VOLUME = 0.7

// 사운드별 톤 구성: [주파수(Hz), 시작 지연(초), 길이(초)] — 재생 로직은 playSound 하나로 공유
const SOUND_TONES: Record<SoundType, [number, number, number][]> = {
  bell: [[880, 0, 1.5]], // A5 단음 벨
  chime: [
    [523.25, 0, 0.9], // C5
    [659.25, 0.15, 0.9], // E5
    [783.99, 0.3, 1.2], // G5 아르페지오
  ],
  soft: [[440, 0, 2.5]], // A4 긴 페이드
}

// Web Audio API로 알림음 재생 (서버·음원 파일 불필요)
export const playSound = (type: SoundType): void => {
  const ctx = new AudioContext()
  let endOfSound = 0

  for (const [frequency, delay, duration] of SOUND_TONES[type]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = frequency

    const start = ctx.currentTime + delay
    gain.gain.setValueAtTime(VOLUME, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    osc.start(start)
    osc.stop(start + duration)
    endOfSound = Math.max(endOfSound, delay + duration)
  }

  // 재생이 끝나면 AudioContext를 닫아 리소스 누수 방지
  setTimeout(() => void ctx.close(), (endOfSound + 0.1) * 1000)
}
