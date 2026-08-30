import type { Note } from '../types/note'
import type { TimerPhase } from '../types/timer'
import { EVENTS, type NotifyEventType } from '../utils/notifyEvents'

const OFFSCREEN_URL = 'offscreen.html'

// (노트 타입, 단계) → 종료 이벤트. 일정 노트는 단계 구분 없이 종료로 처리
export const resolvePhaseEndEvent = (
  noteType: Note['type'],
  phase: TimerPhase,
): NotifyEventType =>
  noteType === 'schedule'
    ? 'scheduleEnd'
    : phase === 'work'
      ? 'sessionComplete'
      : 'breakEnd'

// 오디오 재생용 offscreen 문서를 하나만 유지 — 동시 생성 요청은 하나의 Promise로 직렬화
let creating: Promise<void> | null = null
const ensureOffscreenDocument = async (): Promise<void> => {
  if (await chrome.offscreen.hasDocument()) return
  if (!creating)
    creating = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
        justification: '타이머 종료 알림음 재생',
      })
      .finally(() => {
        creating = null
      })
  await creating
}

// 종료 이벤트별 노트 채널 설정 — 뽀모도로는 complete, 일정은 end 필드를 사용
const channelsFor = (note: Note): { os: boolean; sound: boolean } =>
  note.type === 'pomodoro'
    ? { os: note.notifyOnComplete, sound: note.soundOnComplete }
    : { os: note.notifyOnEnd, sound: note.soundOnEnd }

// 백그라운드에서 타이머 종료를 알림 — OS 알림은 직접, 사운드는 offscreen 경유
export const notifyPhaseEnd = async (
  note: Note,
  phase: TimerPhase,
): Promise<void> => {
  const event = resolvePhaseEndEvent(note.type, phase)
  const channels = channelsFor(note)

  if (channels.os)
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('/icons/icon128.png'),
      title: note.title,
      message: EVENTS[event].message,
    })

  if (channels.sound) {
    await ensureOffscreenDocument()
    // offscreen 리스너가 아직 없더라도 실패가 전체 흐름을 막지 않도록 방어
    void chrome.runtime
      .sendMessage({ type: 'play-sound', sound: EVENTS[event].sound })
      .catch(() => undefined)
  }
}
