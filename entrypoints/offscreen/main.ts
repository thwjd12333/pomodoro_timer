import { playSound, type SoundType } from '../../src/utils/soundUtils'

interface PlaySoundMessage {
  type: 'play-sound'
  sound: SoundType
}

// 백그라운드가 보내는 알림음 재생 요청만 처리 — 서비스 워커는 Web Audio를 직접 쓸 수 없음
const isPlaySoundMessage = (message: unknown): message is PlaySoundMessage =>
  typeof message === 'object' &&
  message !== null &&
  (message as { type?: unknown }).type === 'play-sound'

chrome.runtime.onMessage.addListener(message => {
  if (isPlaySoundMessage(message)) playSound(message.sound)
})
