export type TimerPhase = 'work' | 'break'

export interface TimerState {
  noteId: string | null
  phase: TimerPhase
  isRunning: boolean
  total: number // 현재 단계 전체 초
  remaining: number // 일시정지 시점의 남은 초 (진행 중엔 endsAt으로 파생)
  endsAt: number | null // 진행 중일 때 단계 종료 시각 timestamp — 팝업 재오픈 시 복원 기준
}

export const IDLE_TIMER_STATE: TimerState = {
  noteId: null,
  phase: 'work',
  isRunning: false,
  total: 0,
  remaining: 0,
  endsAt: null,
}
