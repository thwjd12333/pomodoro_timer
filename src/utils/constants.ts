import type { Tag, TagColor } from '../types/tag'

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
