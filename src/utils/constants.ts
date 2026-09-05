import type { NoteStatus, NoteType } from '../types/note'
import type { Tag, TagColor } from '../types/tag'

// 뱃지는 색 점 + 중립 텍스트로 표시하므로 여기 색은 점 전용
export const TYPE_META: Record<NoteType, { label: string; color: string }> = {
  pomodoro: { label: '뽀모도로', color: 'var(--color-accent)' },
  schedule: { label: '일정 타이머', color: '#1FA97C' },
}

export const STATUS_LABEL: Record<NoteStatus, string> = {
  idle: '대기',
  running: '진행 중',
  paused: '일시정지',
  done: '완료',
  failed: '미완료',
  skipped: '넘김',
}

// done/skipped는 완료 뱃지(흰 글리프 + 채움색) 대비를 위해 살짝 더 짙게 조정
export const STATUS_DOT: Record<NoteStatus, string> = {
  idle: 'var(--text-secondary)',
  running: 'var(--color-accent)',
  paused: '#e0a72e',
  done: '#128f66',
  failed: '#e2543d',
  skipped: '#a8752e',
}

export const TAG_COLORS: Record<TagColor, string> = {
  purple: '#7d74e6',
  teal: '#1fa97c',
  coral: '#e2653d',
  amber: '#c98a3b',
  blue: '#3a8de0',
  pink: '#d4568a',
}

export const DEFAULT_TAGS: Tag[] = [
  { id: 'work', label: '업무', color: 'purple' },
  { id: 'personal', label: '개인', color: 'teal' },
  { id: 'study', label: '공부', color: 'amber' },
]

export const DEFAULT_WORK_DURATION = 50
export const DEFAULT_BREAK_DURATION = 10
