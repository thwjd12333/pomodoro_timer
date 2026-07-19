import type { NoteStatus, NoteType } from '../types/note'
import type { Tag, TagColor } from '../types/tag'
import type { TimerPhase } from '../types/timer'

// 진행 중 뽀모도로 카드 테두리 — 집중: 초록, 휴식: 파랑
export const PHASE_COLORS: Record<TimerPhase, string> = {
  work: '#30d158',
  break: '#378ADD',
}

export const TYPE_META: Record<NoteType, { label: string; color: string }> = {
  pomodoro: { label: '뽀모도로', color: 'var(--color-accent)' },
  schedule: { label: '일정 타이머', color: '#1D9E75' },
}

export const STATUS_DOT: Record<NoteStatus, string> = {
  idle: 'var(--text-secondary)',
  running: '#30d158',
  paused: '#ffd60a',
  done: '#0F6E56',
  failed: '#B74A4A',
  skipped: '#9B6B2E',
}

export const TAG_COLORS: Record<TagColor, string> = {
  purple: '#7F77DD',
  teal: '#1D9E75',
  coral: '#D85A30',
  amber: '#BA7517',
  blue: '#378ADD',
  pink: '#D4537E',
}

export const DEFAULT_TAGS: Tag[] = [
  { id: 'work', label: '업무', color: 'purple' },
  { id: 'personal', label: '개인', color: 'teal' },
  { id: 'study', label: '공부', color: 'amber' },
]

export const DEFAULT_WORK_DURATION = 50
export const DEFAULT_BREAK_DURATION = 10
