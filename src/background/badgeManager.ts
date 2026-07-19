import type { NoteType } from '../types/note'

// 뱃지 배경색 — 뽀모도로: 앱 액센트 보라, 일정 타이머: 초록
const BADGE_COLOR: Record<NoteType, string> = {
  pomodoro: '#6470d0',
  schedule: '#1D9E75',
}

// 남은 시간을 'Nm' 형태로 익스텐션 아이콘 뱃지에 표시
export const updateBadge = async (
  remainingSeconds: number,
  type: NoteType,
): Promise<void> => {
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR[type] })
  await chrome.action.setBadgeTextColor({ color: '#ffffff' })
  await chrome.action.setBadgeText({
    text: `${Math.ceil(remainingSeconds / 60)}m`,
  })
}

export const clearBadge = (): Promise<void> =>
  chrome.action.setBadgeText({ text: '' })
