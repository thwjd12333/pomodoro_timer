import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Note } from '../types/note'
import { IDLE_TIMER_STATE, type TimerPhase, type TimerState } from '../types/timer'
import { chromeStorage } from './chromeStorage'

interface AppStore {
  notes: Note[]
  timerState: TimerState
  addNote: (note: Note) => void
  deleteNote: (noteId: string) => void
  startTimer: (noteId: string) => void
  pauseTimer: () => void
  resumeTimer: () => void
  completeNote: (noteId: string) => void
  advancePhase: () => void
}

const STORAGE_KEY = 'focuscal'

const remainingSeconds = (endsAt: number): number =>
  Math.max(0, Math.round((endsAt - Date.now()) / 1000))

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      notes: [],
      timerState: IDLE_TIMER_STATE,

      addNote: (note) => set((s) => ({ notes: [...s.notes, note] })),

      deleteNote: (noteId) =>
        set((s) => ({
          notes: s.notes.filter((n) => n.id !== noteId),
          // 진행 중이던 노트를 지우면 타이머도 함께 해제
          timerState: s.timerState.noteId === noteId ? IDLE_TIMER_STATE : s.timerState,
        })),

      startTimer: (noteId) =>
        set((s) => {
          const note = s.notes.find((n) => n.id === noteId)
          if (!note || note.type !== 'pomodoro') return s
          const total = note.workDuration * 60
          return {
            notes: s.notes.map((n) => {
              if (n.id === noteId) return { ...n, status: 'running' as const }
              // 다른 노트가 타이머를 쓰고 있었다면 대기 상태로 되돌림 (동시 타이머는 1개)
              if (n.id === s.timerState.noteId && (n.status === 'running' || n.status === 'paused'))
                return { ...n, status: 'idle' as const }
              return n
            }),
            timerState: {
              noteId,
              phase: 'work' as TimerPhase,
              isRunning: true,
              total,
              remaining: total,
              endsAt: Date.now() + total * 1000,
            },
          }
        }),

      pauseTimer: () =>
        set((s) => {
          if (!s.timerState.isRunning || s.timerState.endsAt === null) return s
          return {
            notes: s.notes.map((n) =>
              n.id === s.timerState.noteId ? { ...n, status: 'paused' as const } : n,
            ),
            timerState: {
              ...s.timerState,
              isRunning: false,
              remaining: remainingSeconds(s.timerState.endsAt),
              endsAt: null,
            },
          }
        }),

      resumeTimer: () =>
        set((s) => {
          if (s.timerState.isRunning || s.timerState.noteId === null) return s
          return {
            notes: s.notes.map((n) =>
              n.id === s.timerState.noteId ? { ...n, status: 'running' as const } : n,
            ),
            timerState: {
              ...s.timerState,
              isRunning: true,
              endsAt: Date.now() + s.timerState.remaining * 1000,
            },
          }
        }),

      completeNote: (noteId) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === noteId ? { ...n, status: 'done' as const } : n)),
          timerState: s.timerState.noteId === noteId ? IDLE_TIMER_STATE : s.timerState,
        })),

      // 현재 단계 종료 → 집중이었으면 세션 수 +1 후 휴식으로, 휴식이었으면 다음 집중으로
      advancePhase: () =>
        set((s) => {
          const note = s.notes.find((n) => n.id === s.timerState.noteId)
          if (!note || note.type !== 'pomodoro' || !s.timerState.isRunning) return s
          const nextPhase: TimerPhase = s.timerState.phase === 'work' ? 'break' : 'work'
          const total =
            (nextPhase === 'work' ? note.workDuration : note.breakDuration) * 60
          return {
            notes:
              s.timerState.phase === 'work'
                ? s.notes.map((n) =>
                    n.id === note.id && n.type === 'pomodoro'
                      ? { ...n, sessionCount: n.sessionCount + 1 }
                      : n,
                  )
                : s.notes,
            timerState: {
              ...s.timerState,
              phase: nextPhase,
              total,
              remaining: total,
              endsAt: Date.now() + total * 1000,
            },
          }
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => chromeStorage),
      partialize: (state) => ({ notes: state.notes, timerState: state.timerState }),
    },
  ),
)

// 다른 창(팝업·독립 창)에서 저장된 변경을 실시간 반영.
// rehydrate는 storage를 읽기만 하고 다시 쓰지 않으므로 쓰기 루프가 생기지 않음
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes[STORAGE_KEY]) void useAppStore.persist.rehydrate()
})
