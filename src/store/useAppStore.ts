import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Note } from '../types/note'
import {
  IDLE_TIMER_STATE,
  type TimerPhase,
  type TimerState,
} from '../types/timer'
import { notify } from '../utils/notifier'
import {
  addMinutes,
  getCurrentTime,
  getTodayDate,
  secondsUntilToday,
} from '../utils/timeUtils'
import { chromeStorage } from './chromeStorage'

// 사용자 응답을 기다리는 세션 전환 결정
// sessionEnd: 집중 종료 → 완료/연장/넘기기, breakEnd: 휴식 종료 → 다음 세션 진행 여부
export interface PendingDecision {
  noteId: string
  kind: 'sessionEnd' | 'breakEnd'
}

interface AppStore {
  notes: Note[]
  timerState: TimerState
  pendingDecision: PendingDecision | null
  addNote: (note: Note) => void
  deleteNote: (noteId: string) => void
  startTimer: (noteId: string) => void
  pauseTimer: () => void
  resumeNote: (noteId: string) => void
  completeNote: (noteId: string) => void
  advancePhase: () => void
  completeSession: () => void
  startBreak: () => void
  skipEndedNote: () => void
  extendNote: (extraMin: number) => void
  startNextSession: () => void
  finishNote: () => void
}

const STORAGE_KEY = 'focuscal'

const remainingSeconds = (endsAt: number): number =>
  Math.max(0, Math.round((endsAt - Date.now()) / 1000))

// 다른 노트가 타이머를 가져갈 때 기존 활성 노트를 보존 —
// 뽀모도로는 남은 시간을 스냅샷해 일시정지로, 일정 타이머는 대기로 되돌림
const suspendActiveNote = (
  s: Pick<AppStore, 'notes' | 'timerState'>,
): Note[] => {
  const active = s.notes.find(n => n.id === s.timerState.noteId)
  if (!active || (active.status !== 'running' && active.status !== 'paused'))
    return s.notes
  return s.notes.map(n => {
    if (n.id !== active.id) return n
    if (n.type === 'schedule') return { ...n, status: 'idle' as const }
    return {
      ...n,
      status: 'paused' as const,
      suspendedTimer: {
        phase: s.timerState.phase,
        remaining:
          s.timerState.isRunning && s.timerState.endsAt !== null
            ? remainingSeconds(s.timerState.endsAt)
            : s.timerState.remaining,
        total: s.timerState.total,
      },
    }
  })
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      notes: [],
      timerState: IDLE_TIMER_STATE,
      pendingDecision: null,

      addNote: note => set(s => ({ notes: [...s.notes, note] })),

      deleteNote: noteId =>
        set(s => ({
          notes: s.notes.filter(n => n.id !== noteId),
          // 진행 중이던 노트를 지우면 타이머·응답 대기도 함께 해제
          timerState:
            s.timerState.noteId === noteId ? IDLE_TIMER_STATE : s.timerState,
          pendingDecision:
            s.pendingDecision?.noteId === noteId ? null : s.pendingDecision,
        })),

      startTimer: noteId => {
        const note = get().notes.find(n => n.id === noteId)
        if (!note) return
        // 뽀모도로는 설정된 집중 시간, 일정 타이머는 지금부터 오늘 종료 시각까지
        const total =
          note.type === 'pomodoro'
            ? note.workDuration * 60
            : secondsUntilToday(note.endTime)
        if (total <= 0) return
        set(s => ({
          // 동시 타이머는 1개 — 기존 활성 노트는 초기화하지 않고 보존해 두고 시작
          notes: suspendActiveNote(s).map(n =>
            n.id === noteId
              ? {
                  ...n,
                  status: 'running' as const,
                  ...(n.type === 'pomodoro' ? { suspendedTimer: null } : {}),
                }
              : n,
          ),
          timerState: {
            noteId,
            phase: 'work' as TimerPhase,
            isRunning: true,
            total,
            remaining: total,
            endsAt: Date.now() + total * 1000,
          },
        }))
        if (note.type === 'schedule')
          notify('scheduleStart', note.title, {
            os: note.notifyOnStart,
            sound: note.soundOnStart,
          })
      },

      pauseTimer: () =>
        set(s => {
          if (!s.timerState.isRunning || s.timerState.endsAt === null) return s
          return {
            notes: s.notes.map(n =>
              n.id === s.timerState.noteId
                ? { ...n, status: 'paused' as const }
                : n,
            ),
            timerState: {
              ...s.timerState,
              isRunning: false,
              remaining: remainingSeconds(s.timerState.endsAt),
              endsAt: null,
            },
          }
        }),

      resumeNote: noteId => {
        const { notes, timerState } = get()
        const note = notes.find(n => n.id === noteId)
        if (!note || note.status !== 'paused') return

        // 활성 노트 본인의 일시정지 해제
        if (timerState.noteId === noteId) {
          if (timerState.isRunning) return
          set(s => ({
            notes: s.notes.map(n =>
              n.id === noteId ? { ...n, status: 'running' as const } : n,
            ),
            timerState: {
              ...s.timerState,
              isRunning: true,
              endsAt: Date.now() + s.timerState.remaining * 1000,
            },
          }))
          return
        }

        // 밀려나 있던 노트 재개 — 현재 활성 노트를 보존하고 스냅샷 시점부터 이어감
        if (note.type !== 'pomodoro' || !note.suspendedTimer) return
        const { phase, remaining, total } = note.suspendedTimer
        set(s => ({
          notes: suspendActiveNote(s).map(n =>
            n.id === noteId && n.type === 'pomodoro'
              ? { ...n, status: 'running' as const, suspendedTimer: null }
              : n,
          ),
          timerState: {
            noteId,
            phase,
            isRunning: true,
            total,
            remaining,
            endsAt: Date.now() + remaining * 1000,
          },
        }))
      },

      completeNote: noteId =>
        set(s => ({
          notes: s.notes.map(n =>
            n.id === noteId ? { ...n, status: 'done' as const } : n,
          ),
          timerState:
            s.timerState.noteId === noteId ? IDLE_TIMER_STATE : s.timerState,
        })),

      // 현재 단계 종료 처리 — 일정: 완료, 뽀모도로: 타이머를 멈추고 응답 대기로 전환
      advancePhase: () => {
        const { notes, timerState } = get()
        const note = notes.find(n => n.id === timerState.noteId)
        if (!note || !timerState.isRunning) return

        if (note.type === 'schedule') {
          set(s => ({
            notes: s.notes.map(n =>
              n.id === note.id ? { ...n, status: 'done' as const } : n,
            ),
            timerState: IDLE_TIMER_STATE,
          }))
          notify('scheduleEnd', note.title, {
            os: note.notifyOnEnd,
            sound: note.soundOnEnd,
          })
          return
        }

        // 집중(연장 포함)이 끝나면 완료 여부, 휴식이 끝나면 다음 세션 진행 여부를 물음
        const kind: PendingDecision['kind'] =
          timerState.phase === 'work' ? 'sessionEnd' : 'breakEnd'
        set(s => ({
          notes:
            kind === 'sessionEnd'
              ? s.notes.map(n =>
                  n.id === note.id && n.type === 'pomodoro'
                    ? { ...n, sessionCount: n.sessionCount + 1 }
                    : n,
                )
              : s.notes,
          timerState: {
            ...s.timerState,
            isRunning: false,
            remaining: 0,
            endsAt: null,
          },
          pendingDecision: { noteId: note.id, kind },
        }))
        notify(
          kind === 'sessionEnd' ? 'sessionComplete' : 'breakEnd',
          note.title,
          {
            os: note.notifyOnComplete,
            sound: note.soundOnComplete,
          },
        )
      },

      // 집중 중 [완료] — 남은 시간과 무관하게 세션을 완료로 치고 휴식 시작
      completeSession: () => {
        const { notes, timerState } = get()
        const note = notes.find(n => n.id === timerState.noteId)
        if (!note || note.type !== 'pomodoro' || timerState.phase !== 'work')
          return
        const total = note.breakDuration * 60
        set(s => ({
          notes: s.notes.map(n =>
            n.id === note.id && n.type === 'pomodoro'
              ? {
                  ...n,
                  sessionCount: n.sessionCount + 1,
                  status: 'running' as const,
                }
              : n,
          ),
          timerState: {
            noteId: note.id,
            phase: 'break' as TimerPhase,
            isRunning: true,
            total,
            remaining: total,
            endsAt: Date.now() + total * 1000,
          },
        }))
      },

      // [네] — 세션 완료 인정, 휴식 시작
      startBreak: () => {
        const { pendingDecision, notes } = get()
        const note = notes.find(n => n.id === pendingDecision?.noteId)
        if (!note || note.type !== 'pomodoro') return
        const total = note.breakDuration * 60
        set({
          timerState: {
            noteId: note.id,
            phase: 'break' as TimerPhase,
            isRunning: true,
            total,
            remaining: total,
            endsAt: Date.now() + total * 1000,
          },
          pendingDecision: null,
        })
      },

      // [넘기기] — 스킵 처리, 이후 일정 밀림 없음
      skipEndedNote: () => {
        const noteId = get().pendingDecision?.noteId
        if (!noteId) return
        set(s => ({
          notes: s.notes.map(n =>
            n.id === noteId ? { ...n, status: 'skipped' as const } : n,
          ),
          timerState: IDLE_TIMER_STATE,
          pendingDecision: null,
        }))
      },

      // [시작하기] — 휴식 종료 응답에서 다음 집중 세션 시작
      startNextSession: () => {
        const { pendingDecision, notes } = get()
        if (pendingDecision?.kind !== 'breakEnd') return
        const note = notes.find(n => n.id === pendingDecision.noteId)
        if (!note || note.type !== 'pomodoro') return
        const total = note.workDuration * 60
        set({
          timerState: {
            noteId: note.id,
            phase: 'work' as TimerPhase,
            isRunning: true,
            total,
            remaining: total,
            endsAt: Date.now() + total * 1000,
          },
          pendingDecision: null,
        })
      },

      // [그만하기] — 노트를 완료 상태로 종료
      finishNote: () => {
        const noteId = get().pendingDecision?.noteId
        if (!noteId) return
        set(s => ({
          notes: s.notes.map(n =>
            n.id === noteId ? { ...n, status: 'done' as const } : n,
          ),
          timerState: IDLE_TIMER_STATE,
          pendingDecision: null,
        }))
      },

      // [연장하기] — 연장 집중 세션을 바로 시작하고, 오늘 대기 중인 일정들을 연장분만큼 밀어냄
      extendNote: extraMin => {
        const { pendingDecision, notes } = get()
        const note = notes.find(n => n.id === pendingDecision?.noteId)
        if (!note || note.type !== 'pomodoro') return

        const nowTime = getCurrentTime()
        const today = getTodayDate()
        const total = extraMin * 60

        set(s => ({
          notes: s.notes.map(n => {
            // 원래 시간 설정은 보존하고 연장 시간만 누적 기록
            if (n.id === note.id && n.type === 'pomodoro')
              return { ...n, extendedMinutes: n.extendedMinutes + extraMin }
            if (
              n.type === 'schedule' &&
              n.status === 'idle' &&
              n.date === today &&
              n.startTime >= nowTime
            )
              return {
                ...n,
                startTime: addMinutes(n.startTime, extraMin),
                endTime: addMinutes(n.endTime, extraMin),
              }
            return n
          }),
          timerState: {
            noteId: note.id,
            phase: 'work' as TimerPhase,
            isRunning: true,
            total,
            remaining: total,
            endsAt: Date.now() + total * 1000,
          },
          pendingDecision: null,
        }))
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => chromeStorage),
      partialize: state => ({
        notes: state.notes,
        timerState: state.timerState,
        // 팝업이 닫혔다 열려도(OS 알림 클릭 포함) 결정 플로우가 이어지도록 저장
        pendingDecision: state.pendingDecision,
      }),
    },
  ),
)

// 다른 창(팝업·독립 창)에서 저장된 변경을 실시간 반영.
// rehydrate는 storage를 읽기만 하고 다시 쓰지 않으므로 쓰기 루프가 생기지 않음
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes[STORAGE_KEY])
    void useAppStore.persist.rehydrate()
})
