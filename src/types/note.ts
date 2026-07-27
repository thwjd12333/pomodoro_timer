import type { TimerPhase } from './timer'

export type NoteType = 'pomodoro' | 'schedule'
export type NoteStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'done'
  | 'failed'
  | 'skipped'

interface BaseNote {
  id: string
  type: NoteType
  title: string
  status: NoteStatus
  createdAt: number
  date: string // 'YYYY-MM-DD' — 날짜 그룹 키
  tagId: string | null
  order: number // 같은 date 그룹 내에서만 비교되는 진행 순서 (작을수록 상단)
}

export interface PomodoroNote extends BaseNote {
  type: 'pomodoro'
  workDuration: number // 분 단위
  breakDuration: number // 분 단위
  sessionCount: number // 완료된 세션 수
  extendedMinutes: number // 누적 연장 시간(분), 0이면 연장 없음
  // 다른 노트 시작으로 밀려났을 때의 타이머 스냅샷 — 재개 시 이 시점부터 이어감
  suspendedTimer: { phase: TimerPhase; remaining: number; total: number } | null
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

// 노트 생성 시 전달하는 값 — order는 addNote가 내부에서 계산해 부여함
export type NoteInput =
  | Omit<PomodoroNote, 'order'>
  | Omit<ScheduleNote, 'order'>
