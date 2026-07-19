import { playSound, type SoundType } from './soundUtils'

export type NotifyEventType =
  | 'sessionComplete'
  | 'breakEnd'
  | 'scheduleStart'
  | 'scheduleEnd'

// 알림 통합 테이블 — 이벤트별 메시지·사운드 (뱃지는 background가 타이머 상태를 보고 처리)
const EVENTS: Record<NotifyEventType, { message: string; sound: SoundType }> = {
  sessionComplete: {
    message: '집중 세션이 끝났어요. 일정을 완료하셨나요?',
    sound: 'bell',
  },
  breakEnd: {
    message: '휴식이 끝났어요. 다음 세션을 시작할까요?',
    sound: 'soft',
  },
  scheduleStart: { message: '일정을 시작해요.', sound: 'chime' },
  scheduleEnd: { message: '일정 시간이 끝났어요.', sound: 'bell' },
}

// OS 알림과 사운드를 노트별 설정에 따라 발송하는 단일 진입점
export const notify = (
  type: NotifyEventType,
  noteTitle: string,
  channels: { os: boolean; sound: boolean },
): void => {
  if (channels.os)
    void chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('/icons/icon128.png'),
      title: noteTitle,
      message: EVENTS[type].message,
    })
  if (channels.sound) playSound(EVENTS[type].sound)
}
