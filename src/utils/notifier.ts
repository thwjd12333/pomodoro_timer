import { EVENTS, type NotifyEventType } from './notifyEvents'
import { playSound } from './soundUtils'

// OS 알림과 사운드를 노트별 설정에 따라 발송하는 단일 진입점 (팝업 컨텍스트 전용)
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
