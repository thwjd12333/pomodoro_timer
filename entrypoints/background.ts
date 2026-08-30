import type { Note } from '../src/types/note'
import type { TimerPhase, TimerState } from '../src/types/timer'
import { clearBadge, updateBadge } from '../src/background/badgeManager'
import { notifyPhaseEnd } from '../src/background/phaseNotifier'

const STORAGE_KEY = 'focuscal'
const BADGE_ALARM = 'badge-refresh'
const TIMER_ALARM = 'timer-end'
const ALARM_CONTEXT_KEY = 'timerAlarmContext'

// 알람은 페이로드를 실을 수 없고, 발화 시점엔 팝업이 이미 timerState를 비웠을 수 있어
// 예약 시점의 판별 정보를 storage.session에 따로 보관한다
interface TimerAlarmContext {
  noteId: string
  phase: TimerPhase
  endsAt: number
}

// zustand persist가 저장한 JSON 문자열에서 앱 상태를 꺼냄
interface PersistedState {
  state: { notes: Note[]; timerState: TimerState }
}

const readAppState = async (): Promise<PersistedState['state'] | null> => {
  const result = await chrome.storage.sync.get(STORAGE_KEY)
  const raw = result[STORAGE_KEY]
  if (typeof raw !== 'string') return null
  try {
    return (JSON.parse(raw) as PersistedState).state
  } catch {
    return null
  }
}

// 진행 중 타이머의 남은 분을 뱃지에 반영하고, 진행 여부에 따라 주기 갱신 알람을 켜고 끔
const refreshBadge = async (): Promise<void> => {
  const state = await readAppState()
  const timer = state?.timerState

  const stop = async () => {
    await chrome.alarms.clear(BADGE_ALARM)
    await clearBadge()
  }

  if (!state || !timer?.isRunning || timer.endsAt === null) return stop()

  const note = state.notes.find(n => n.id === timer.noteId)
  const remaining = Math.round((timer.endsAt - Date.now()) / 1000)
  // 팝업이 닫힌 채 단계가 끝난 경우 — 다음 팝업 오픈 때 단계 전환이 일어나므로 뱃지만 정리
  if (!note || remaining <= 0) return stop()

  await updateBadge(remaining, note.type)
  // 뱃지는 분 단위 표시라 30초 주기(chrome.alarms 최소값)면 충분
  if (!(await chrome.alarms.get(BADGE_ALARM)))
    await chrome.alarms.create(BADGE_ALARM, { periodInMinutes: 0.5 })
}

const readAlarmContext = async (): Promise<TimerAlarmContext | undefined> => {
  const stored = await chrome.storage.session.get(ALARM_CONTEXT_KEY)
  return stored[ALARM_CONTEXT_KEY] as TimerAlarmContext | undefined
}

// 진행 중이면 endsAt 시점에 timer-end 알람을 예약하고, 아니면 정리한다.
// 단, 만료가 이미 일어난 직후라면(팝업이 먼저 단계를 전환한 경우) 예약된 알람이
// 한 번 발화하도록 남겨둔다 — handleTimerEnd가 발화 후 컨텍스트를 제거한다.
const syncAlarm = async (): Promise<void> => {
  const timer = (await readAppState())?.timerState

  if (timer?.isRunning && timer.endsAt !== null && timer.noteId !== null) {
    const context: TimerAlarmContext = {
      noteId: timer.noteId,
      phase: timer.phase,
      endsAt: timer.endsAt,
    }
    await chrome.storage.session.set({ [ALARM_CONTEXT_KEY]: context })
    await chrome.alarms.create(TIMER_ALARM, { when: timer.endsAt })
    return
  }

  const context = await readAlarmContext()
  // 만료 임박(2초 이내)·경과 상태면 실제 종료로 보고 알람을 남겨 발화시킴
  if (context && Date.now() >= context.endsAt - 2000) return

  await chrome.alarms.clear(TIMER_ALARM)
  await chrome.storage.session.remove(ALARM_CONTEXT_KEY)
}

// timer-end 알람 발화 → 예약 컨텍스트로 종료 이벤트를 판별해 알림 발송 (1회성)
const handleTimerEnd = async (): Promise<void> => {
  const context = await readAlarmContext()
  await chrome.storage.session.remove(ALARM_CONTEXT_KEY)
  if (!context || Date.now() < context.endsAt - 2000) return

  const note = (await readAppState())?.notes.find(n => n.id === context.noteId)
  if (!note) return

  await notifyPhaseEnd(note, context.phase)
}

export default defineBackground(() => {
  // 팝업에서 타이머 시작/일시정지/완료 시 저장소가 갱신되는 즉시 뱃지와 알람을 반영
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes[STORAGE_KEY]) {
      void refreshBadge()
      void syncAlarm()
    }
  })

  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === BADGE_ALARM) void refreshBadge()
    if (alarm.name === TIMER_ALARM) void handleTimerEnd()
  })

  // OS 알림 클릭 → 익스텐션 팝업을 열어 세션 종료 플로우로 이어감
  chrome.notifications.onClicked.addListener(notificationId => {
    void chrome.notifications.clear(notificationId)
    chrome.action.openPopup().catch(() =>
      // 팝업을 열 수 없는 상황(포커스된 창 없음 등)에서는 독립 창으로 대체
      chrome.windows.create({
        url: chrome.runtime.getURL('/popup.html?mode=window'),
        type: 'popup',
        width: 380,
        height: 620,
        focused: true,
      }),
    )
  })

  // 브라우저 시작·서비스 워커 재기동 시 상태 복원
  void refreshBadge()
  void syncAlarm()
})
