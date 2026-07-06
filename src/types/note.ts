export type NoteType = 'pomodoro' | 'schedule'
export type NoteStatus = 'idle' | 'running' | 'paused' | 'done' | 'failed' | 'skipped'
export type RepeatType = 'none' | 'daily' | 'weekdays'

interface BaseNote {
  id: string
  type: NoteType
  title: string
  status: NoteStatus
  createdAt: number
  date: string // 'YYYY-MM-DD' — 날짜 그룹 키
  tagId: string | null
  repeat: RepeatType
  parentId: string | null // 반복 생성된 경우 원본 노트 ID
}

export interface PomodoroNote extends BaseNote {
  type: 'pomodoro'
  workDuration: number // 분 단위
  breakDuration: number // 분 단위
  sessionCount: number // 완료된 세션 수
  notifyOnComplete: boolean
  soundOnComplete: boolean
}

export interface ScheduleNote extends BaseNote {
  type: 'schedule'
  startTime: string // 'HH:mm'
  endTime: string // 'HH:mm'
  notifyOnStart: boolean
  notifyOnEnd: boolean
  soundOnStart: boolean
  soundOnEnd: boolean
}

export type Note = PomodoroNote | ScheduleNote
