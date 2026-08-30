import type { SoundType } from './soundUtils'

export type NotifyEventType =
  | 'sessionComplete'
  | 'breakEnd'
  | 'scheduleStart'
  | 'scheduleEnd'

// 알림 통합 테이블 — 이벤트별 메시지·사운드. 팝업(notifier)과 백그라운드(phaseNotifier)가 공유
export const EVENTS: Record<
  NotifyEventType,
  { message: string; sound: SoundType }
> = {
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
