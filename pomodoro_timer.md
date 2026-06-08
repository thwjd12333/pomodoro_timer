# FocusCal — Chrome Extension Project Spec

## 개요
뽀모도로 타이머 + 일정 타이머를 하나의 화면에서 스티키노트 형태로 관리하는 Chrome Extension.

---

## 기술 스택
- **Frontend**: React + TypeScript
- **State**: Zustand (전역 상태 관리)
- **Build**: Vite + @crxjs/vite-plugin
- **Storage**: chrome.storage.sync + Zustand persist 미들웨어
- **Notifications**: chrome.notifications (OS 알림) + Web Audio API (사운드)
- **Timer**: chrome.alarms (Service Worker 기반)
- **Badge**: chrome.action.setBadgeText (아이콘 뱃지)
- **Theme**: prefers-color-scheme + chrome.storage.sync (다크모드)
- **Architecture**: Repository 패턴 (storage 교체 가능하도록 추상화)
- **Manifest**: V3

---

## 프로젝트 구조

```
focuscal-extension/
├── public/
│   ├── manifest.json
│   ├── icons/
│   └── sounds/                         # 알림 사운드 파일 (mp3/ogg)
│       ├── session-end.mp3
│       └── schedule-alert.mp3
├── src/
│   ├── background/
│   │   ├── index.ts                    # Service Worker 진입점
│   │   ├── alarmManager.ts             # chrome.alarms 등록/해제/재등록
│   │   ├── notificationManager.ts      # chrome.notifications 발송
│   │   ├── badgeManager.ts             # chrome.action 뱃지 업데이트
│   │   └── repeatManager.ts            # 반복 일정 자동 생성
│   ├── popup/
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   └── popup.html
│   ├── components/
│   │   ├── PomodoroNote.tsx
│   │   ├── ScheduleNote.tsx
│   │   ├── NoteBottomSheet.tsx         # 새 노트 추가 바텀시트
│   │   ├── SessionEndPopup.tsx         # 세션 종료 팝업
│   │   ├── ExtendSheet.tsx             # 연장 세팅 바텀시트
│   │   ├── TagFilter.tsx               # 태그 필터 바
│   │   └── ThemeToggle.tsx             # 다크모드 토글
│   ├── hooks/
│   │   ├── useTimer.ts
│   │   ├── useSchedules.ts
│   │   └── useSound.ts                 # 사운드 재생
│   ├── store/
│   │   ├── useAppStore.ts              # Zustand 메인 스토어 (notes, timerState, settings)
│   │   ├── chromeStorage.ts            # chrome.storage.sync Zustand 어댑터
│   │   └── actions/
│   │       ├── noteActions.ts          # 노트 관련 액션
│   │       ├── timerActions.ts         # 타이머 관련 액션
│   │       └── settingsActions.ts      # 설정 관련 액션
│   ├── storage/
│   │   ├── ISessionRepository.ts
│   │   ├── IScheduleRepository.ts
│   │   ├── SyncStorageSessionRepository.ts
│   │   └── SyncStorageScheduleRepository.ts
│   ├── container.ts
│   ├── types/
│   │   ├── note.ts
│   │   ├── timer.ts
│   │   ├── session.ts
│   │   ├── messages.ts
│   │   ├── tag.ts                      # 태그/색상 타입
│   │   └── settings.ts                 # 전역 설정 타입
│   └── utils/
│       ├── timeUtils.ts
│       ├── formatters.ts
│       ├── soundUtils.ts               # Web Audio API 유틸
│       └── constants.ts
```

---

## 타입 정의

### Tag 타입
```typescript
type TagColor =
  | 'purple'   // #7F77DD
  | 'teal'     // #1D9E75
  | 'coral'    // #D85A30
  | 'amber'    // #BA7517
  | 'blue'     // #378ADD
  | 'pink'     // #D4537E

interface Tag {
  id: string
  label: string
  color: TagColor
}
```

### Note 타입
```typescript
type NoteType = 'pomodoro' | 'schedule'
type NoteStatus = 'idle' | 'running' | 'paused' | 'done' | 'failed' | 'skipped'
type RepeatType = 'none' | 'daily' | 'weekdays'  // 반복 일정

interface BaseNote {
  id: string
  type: NoteType
  title: string
  status: NoteStatus
  createdAt: number       // timestamp
  date: string            // 'YYYY-MM-DD' — 날짜 그룹 키
  tagId: string | null    // 태그 (없으면 null)
  repeat: RepeatType      // 반복 설정 (디폴트 'none')
  parentId: string | null // 반복 생성된 경우 원본 노트 ID
}

interface PomodoroNote extends BaseNote {
  type: 'pomodoro'
  workDuration: number    // 분 단위, 디폴트 50
  breakDuration: number   // 분 단위, 디폴트 10
  sessionCount: number    // 완료된 세션 수
  notifyOnComplete: boolean
  soundOnComplete: boolean
}

interface ScheduleNote extends BaseNote {
  type: 'schedule'
  startTime: string       // 'HH:mm'
  endTime: string         // 'HH:mm'
  notifyOnStart: boolean
  notifyOnEnd: boolean
  soundOnStart: boolean
  soundOnEnd: boolean
}

type Note = PomodoroNote | ScheduleNote
```

### Settings 타입
```typescript
type ThemeMode = 'system' | 'light' | 'dark'
type SoundType = 'bell' | 'chime' | 'soft' | 'none'

interface Settings {
  theme: ThemeMode            // 디폴트 'system'
  soundType: SoundType        // 디폴트 'bell'
  soundVolume: number         // 0~1, 디폴트 0.7
  tags: Tag[]                 // 사용자 정의 태그 목록
  defaultWorkDuration: number // 디폴트 50
  defaultBreakDuration: number // 디폴트 10
}
```

### TimerState 타입
```typescript
type TimerPhase = 'work' | 'break'

interface TimerState {
  noteId: string | null
  phase: TimerPhase
  remaining: number       // 초 단위
  total: number           // 초 단위
  isRunning: boolean
  sessionCount: number
}
```

### Session 타입
```typescript
interface Session {
  id: string
  noteId: string
  startedAt: number       // timestamp
  duration: number        // 초 단위 실제 진행 시간
  phase: TimerPhase
  completed: boolean
}
```

### Message 타입 (Popup ↔ Background)
```typescript
type MessageType =
  | 'START_TIMER'
  | 'PAUSE_TIMER'
  | 'RESUME_TIMER'
  | 'SKIP_SESSION'
  | 'COMPLETE_NOTE'
  | 'FAIL_NOTE'
  | 'EXTEND_NOTE'
  | 'GET_TIMER_STATE'
  | 'TIMER_STATE_UPDATED'
  | 'SESSION_ENDED'
  | 'UPDATE_BADGE'
  | 'CLEAR_BADGE'
  | 'THEME_CHANGED'

interface Message {
  type: MessageType
  payload?: unknown
}
```

---

## Zustand 스토어 설계

### 설치
```bash
npm install zustand
```

### 스토어 구조 (useAppStore.ts)
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { chromeStorage } from './chromeStorage'

interface AppStore {
  // ── State ──────────────────────────────
  notes: Note[]
  timerState: TimerState
  settings: Settings
  activeTagId: string | null   // 태그 필터 (UI 전용, 저장 안 함)

  // ── Note Actions ───────────────────────
  addNote: (note: Note) => void
  deleteNote: (id: string) => void
  updateNote: (id: string, patch: Partial<Note>) => void
  completeNote: (id: string) => void
  failNote: (id: string) => void
  skipNote: (id: string) => void
  extendNote: (id: string, workMin: number, breakMin: number) => void
  shiftNotesAfter: (fromTime: string, offsetMin: number) => void  // 일정 밀림

  // ── Timer Actions ──────────────────────
  setTimerState: (state: Partial<TimerState>) => void
  tickTimer: (remaining: number) => void
  clearTimer: () => void

  // ── Settings Actions ───────────────────
  updateSettings: (patch: Partial<Settings>) => void
  addTag: (tag: Tag) => void
  removeTag: (id: string) => void

  // ── UI Actions (저장 안 함) ────────────
  setActiveTag: (tagId: string | null) => void
}

const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      notes: [],
      timerState: { noteId: null, phase: 'work', remaining: 0, total: 0, isRunning: false, sessionCount: 0 },
      settings: {
        theme: 'system',
        soundType: 'bell',
        soundVolume: 0.7,
        tags: DEFAULT_TAGS,
        defaultWorkDuration: 50,
        defaultBreakDuration: 10,
      },
      activeTagId: null,

      // Note Actions
      addNote: (note) =>
        set((s) => ({ notes: [...s.notes, note] })),

      deleteNote: (id) =>
        set((s) => ({ notes: s.notes.filter(n => n.id !== id) })),

      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map(n => n.id === id ? { ...n, ...patch } : n)
        })),

      completeNote: (id) =>
        set((s) => ({
          notes: s.notes.map(n => n.id === id ? { ...n, status: 'done' } : n),
          timerState: { ...s.timerState, noteId: null, isRunning: false }
        })),

      failNote: (id) =>
        set((s) => ({
          notes: s.notes.map(n => n.id === id ? { ...n, status: 'failed' } : n)
        })),

      skipNote: (id) =>
        set((s) => ({
          notes: s.notes.map(n => n.id === id ? { ...n, status: 'skipped' } : n),
          timerState: { ...s.timerState, noteId: null, isRunning: false }
        })),

      extendNote: (id, workMin, breakMin) =>
        set((s) => ({
          notes: s.notes.map(n =>
            n.id === id && n.type === 'pomodoro'
              ? { ...n, workDuration: workMin, breakDuration: breakMin, status: 'failed' }
              : n
          )
        })),

      // A 일정 연장 시 이후 대기 중 일정들 startTime 밀기
      shiftNotesAfter: (fromTime, offsetMin) =>
        set((s) => ({
          notes: s.notes.map(n => {
            if (n.type !== 'schedule' || n.status !== 'idle') return n
            if (n.startTime <= fromTime) return n
            return {
              ...n,
              startTime: addMinutes(n.startTime, offsetMin),
              endTime:   addMinutes(n.endTime,   offsetMin),
            }
          })
        })),

      // Timer Actions
      setTimerState: (patch) =>
        set((s) => ({ timerState: { ...s.timerState, ...patch } })),

      tickTimer: (remaining) =>
        set((s) => ({ timerState: { ...s.timerState, remaining } })),

      clearTimer: () =>
        set((s) => ({
          timerState: { ...s.timerState, noteId: null, isRunning: false, remaining: 0 }
        })),

      // Settings Actions
      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      addTag: (tag) =>
        set((s) => ({ settings: { ...s.settings, tags: [...s.settings.tags, tag] } })),

      removeTag: (id) =>
        set((s) => ({
          settings: { ...s.settings, tags: s.settings.tags.filter(t => t.id !== id) }
        })),

      // UI Actions
      setActiveTag: (tagId) => set({ activeTagId: tagId }),
    }),
    {
      name: 'focuscal',
      storage: createJSONStorage(() => chromeStorage), // chrome.storage.sync 연결
      partialize: (state) => ({
        notes: state.notes,
        timerState: state.timerState,
        settings: state.settings,
        // activeTagId는 UI 전용이라 저장 제외
      }),
    }
  )
)
```

### chrome.storage.sync 어댑터 (chromeStorage.ts)
```typescript
// Zustand persist가 요구하는 인터페이스에 맞게 chrome.storage.sync를 감쌈
export const chromeStorage = {
  getItem: async (name: string) => {
    const result = await chrome.storage.sync.get(name)
    return result[name] ?? null
  },
  setItem: async (name: string, value: string) => {
    await chrome.storage.sync.set({ [name]: value })
  },
  removeItem: async (name: string) => {
    await chrome.storage.sync.remove(name)
  },
}
```

### 컴포넌트에서 사용법
```typescript
// 필요한 상태/액션만 골라 구독 — 다른 상태가 바뀌어도 리렌더링 없음
function PomodoroNote({ note }: { note: PomodoroNote }) {
  const completeNote = useAppStore((s) => s.completeNote)
  const timerState  = useAppStore((s) => s.timerState)

  const isRunning = timerState.noteId === note.id && timerState.isRunning

  return (
    <button onClick={() => completeNote(note.id)}>완료</button>
  )
}

// 설정에서 테마만 구독
function ThemeToggle() {
  const theme          = useAppStore((s) => s.settings.theme)
  const updateSettings = useAppStore((s) => s.updateSettings)

  return (
    <button onClick={() => updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
```

### background.js ↔ Popup 상태 동기화
```typescript
// popup/App.tsx — background에서 타이머 tick 메시지 수신 시 스토어 업데이트
useEffect(() => {
  const listener = (msg: Message) => {
    if (msg.type === 'TIMER_STATE_UPDATED') {
      useAppStore.getState().setTimerState(msg.payload)
    }
    if (msg.type === 'SESSION_ENDED') {
      // 세션 종료 팝업 표시
    }
  }
  chrome.runtime.onMessage.addListener(listener)
  return () => chrome.runtime.onMessage.removeListener(listener)
}, [])
```

---

## 화면 구조

### 팝업 크기
```css
body {
  width: 360px;
  height: 580px;
  overflow: hidden;
}
.scroll-area {
  height: calc(580px - 48px - 36px); /* topbar + 태그필터 제외 */
  overflow-y: auto;
}
```

### 메인 화면 레이아웃
```
┌──────────────────────────────────┐
│ FocusCal          [🌙] [+]       │  ← 다크모드 토글 + 새 노트 추가
├──────────────────────────────────┤
│ [전체] [업무] [개인] [공부] ...  │  ← 태그 필터 바 (가로 스크롤)
├──────────────────────────────────┤
│ ── 4월 26일 토요일 · 오늘 ──     │
│  [진행 중 노트]                   │  ← 최상단 고정
│  [대기 중 노트들]                 │  ← 시간순 정렬
│  [완료 노트들] (흐리게)           │  ← 하단, 흐리게 유지 (삭제 X)
│                                   │
│ ── 4월 25일 금요일 ────────────── │
│  [완료 노트들] (흐리게)           │
└──────────────────────────────────┘
```

### 노트 카드 구조 (태그 색상 바 추가)
```
┌─ [태그 색상 바 3px] ─────────────┐
│ [타입 뱃지] [반복🔄] [상태 점] [+]│
│ 노트 제목                         │
│ 부제 (세션 설정 or 시간 범위)     │
│ 타이머 숫자 (진행 중일 때)        │
│ ████████░░░░ 진행 바              │
│ 세션 정보             [액션 버튼] │
└───────────────────────────────────┘
```

### 노트 정렬 규칙
1. 진행 중(running/paused) → 최상단 고정
2. 대기 중(idle) → 일정 타이머는 startTime 기준, 뽀모도로는 createdAt 기준
3. 완료/미완료/스킵(done/failed/skipped) → 하단, opacity: 0.5

### 상태 아이콘
| 상태 | 아이콘 | 색상 |
|------|--------|------|
| 완료 (done) | ✓ 체크 | 초록 #0F6E56 |
| 미완료 연장 (failed) | — 가로선 | 빨강 #B74A4A |
| 넘기기 (skipped) | + 십자 | 주황 #9B6B2E |

---

## 뽀모도로 설정

### 디폴트값
- 작업 시간: **50분**
- 휴식 시간: **10분**

### 빠른 전환 버튼
- [25분 / 5분] 버튼 터치 시 즉시 변경
- 직접 입력 필드도 함께 제공

---

## 세션 종료 팝업 플로우

```
세션 종료
    │
    ▼
"일정을 완료하셨나요?"
    ├── [네] ──────────────────→ 완료 처리 (status: done, 초록 체크)
    │
    └── [아니요] ─────────────→ 2단계 선택
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            [연장하기]                          [넘기기]
            작업시간 + 휴식시간 입력            status: skipped
            저장 버튼                          주황 + 아이콘
                │                              이후 일정 밀림 없음
                ▼
            휴식 시작
            status: failed (빨간 - 아이콘)
            이후 일정 startTime 자동 밀림
            chrome.alarms 재등록
```

### 연장 시 일정 밀림 규칙
- A 노트 연장 저장 시: 당일 A 이후의 **대기 중(idle)** 일정만 밀림
- 이미 완료/진행 중인 일정은 밀리지 않음
- 밀린 일정의 chrome.alarms 자동 재등록

---

## 익스텐션 아이콘 뱃지

타이머 진행 중 아이콘에 남은 시간 표시. background.js에서 1초마다 업데이트.

```typescript
// badgeManager.ts
function updateBadge(remaining: number) {
  const mins = Math.ceil(remaining / 60)
  chrome.action.setBadgeText({ text: mins > 0 ? `${mins}m` : '' })
  chrome.action.setBadgeBackgroundColor({ color: '#7F77DD' })
}

function clearBadge() {
  chrome.action.setBadgeText({ text: '' })
}
```

| 상태 | 뱃지 표시 | 색상 |
|------|----------|------|
| 뽀모도로 진행 중 | `18m` | 보라 #7F77DD |
| 일정 타이머 진행 중 | `43m` | 초록 #1D9E75 |
| 타이머 없음 | (빈값) | — |

---

## 사운드 알림

Web Audio API를 사용해 서버 없이 사운드 재생. background.js에서 Offscreen Document를 통해 재생.

```typescript
// soundUtils.ts — Web Audio API로 사운드 생성
function playBell(volume: number) {
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.frequency.value = 880        // A5 음
  osc.type = 'sine'
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5)

  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 1.5)
}
```

| 사운드 타입 | 설명 |
|------------|------|
| `bell` | 단음 벨 (880Hz sine wave) |
| `chime` | 3음 차임 (C-E-G 아르페지오) |
| `soft` | 부드러운 저음 (440Hz, 긴 페이드) |
| `none` | 사운드 없음 |

- 볼륨 슬라이더 0~100% (Settings에서 조정)
- OS 알림과 사운드 독립적으로 on/off 가능
- Manifest V3 Service Worker는 AudioContext 직접 사용 불가 → **Offscreen Document** 사용

```json
// manifest.json에 추가 필요
"permissions": ["alarms", "notifications", "storage", "offscreen"]
```

---

## 반복 일정

```typescript
// repeatManager.ts
// 매일 자정 직후 다음 날 반복 노트 자동 생성
async function generateRepeatNotes(date: string) {
  const { notes } = await chrome.storage.sync.get('notes')

  const repeatingNotes = notes.filter(
    (n: Note) => n.repeat !== 'none' && n.status !== 'idle'
  )

  for (const note of repeatingNotes) {
    const dayOfWeek = new Date(date).getDay() // 0=일, 6=토
    if (note.repeat === 'weekdays' && (dayOfWeek === 0 || dayOfWeek === 6)) continue

    const newNote: Note = {
      ...note,
      id: crypto.randomUUID(),
      status: 'idle',
      date,
      createdAt: Date.now(),
      parentId: note.id,
      sessionCount: 0,
    }
    notes.push(newNote)
  }

  await chrome.storage.sync.set({ notes })
}
```

| 반복 설정 | 동작 |
|----------|------|
| `none` | 반복 없음 (디폴트) |
| `daily` | 매일 자동 생성 |
| `weekdays` | 월~금만 자동 생성 |

- 반복 노트는 카드에 🔄 아이콘 표시
- 반복 설정 변경 시 기존 생성된 노트에는 영향 없음
- 반복 생성 트리거: `chrome.alarms`로 매일 00:01에 실행

---

## 노트 태그 / 색상

```typescript
// 디폴트 태그 (사용자가 추가/수정/삭제 가능)
const DEFAULT_TAGS: Tag[] = [
  { id: 'work',    label: '업무', color: 'purple' },
  { id: 'personal',label: '개인', color: 'teal'   },
  { id: 'study',   label: '공부', color: 'amber'  },
]
```

### 노트 카드 색상 적용
태그 색상은 노트 카드 **좌측 상단 3px 보더** 또는 **좌측 세로 바**로 표시.

```css
/* 태그 색상 바 */
.note[data-tag-color="purple"] { border-left: 3px solid #7F77DD; }
.note[data-tag-color="teal"]   { border-left: 3px solid #1D9E75; }
.note[data-tag-color="amber"]  { border-left: 3px solid #BA7517; }
.note[data-tag-color="coral"]  { border-left: 3px solid #D85A30; }
.note[data-tag-color="blue"]   { border-left: 3px solid #378ADD; }
.note[data-tag-color="pink"]   { border-left: 3px solid #D4537E; }
```

### 태그 필터 바
- 메인 화면 상단 (topbar 아래) 가로 스크롤 가능한 태그 칩 목록
- [전체] 선택 시 모든 노트 표시
- 특정 태그 선택 시 해당 태그 노트만 표시 (날짜 그룹 구조 유지)

---

## 다크모드 / 테마

### 설정값
```typescript
type ThemeMode = 'system' | 'light' | 'dark'
```

| 모드 | 동작 |
|------|------|
| `system` | 시스템 설정 자동 감지 (디폴트) |
| `light` | 항상 라이트 |
| `dark` | 항상 다크 |

### 구현 방식
```typescript
// useTheme.ts
function applyTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  const isDark =
    mode === 'dark' ||
    (mode === 'system' && prefersDark)

  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
}
```

```css
/* CSS 변수 기반 — 컴포넌트 코드 수정 없이 테마 전환 */
:root[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f0;
  --text-primary: #1a1a1a;
  --border: rgba(0,0,0,0.12);
}

:root[data-theme="dark"] {
  --bg-primary: #1e1e2a;
  --bg-secondary: #2a2a38;
  --text-primary: #e8e8e8;
  --border: rgba(255,255,255,0.1);
}
```

- 테마 설정은 `Settings.theme`에 저장 → 기기 간 동기화
- topbar 우측에 🌙 / ☀️ 토글 버튼 배치
- 초기 로드 시 FOUC(깜빡임) 방지: `<script>`로 theme 즉시 적용

---

## 알림 통합 (chrome.notifications + 사운드)

| 이벤트 | OS 알림 | 사운드 | 뱃지 변경 |
|--------|--------|--------|---------|
| 뽀모도로 세션 완료 | ✓ | ✓ bell | 클리어 |
| 일정 타이머 시작 | ✓ | ✓ chime | 초록으로 |
| 일정 타이머 종료 | ✓ | ✓ bell | 클리어 |
| 휴식 시작 | ✓ | ✓ soft | 보라 유지 |

- OS 알림 / 사운드 각각 독립 on/off
- 볼륨 Settings에서 전역 조정

---

## Storage (chrome.storage.sync)

### 저장 키 구조
```typescript
{
  settings: Settings,     // 전역 설정 (테마, 사운드, 태그 목록 등)
  notes: Note[],          // 전체 노트 목록
  sessions: Session[],    // 최근 30일 세션 기록 (자동 정리)
  timerState: TimerState  // 현재 타이머 상태 (background와 공유)
}
```

### 30일 자동 정리
```typescript
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000
sessions.filter(s => Date.now() - s.startedAt < THIRTY_DAYS)
```

### Repository 인터페이스 (추후 교체 대응)
```typescript
export const sessionRepository: ISessionRepository = new SyncStorageSessionRepository()
export const scheduleRepository: IScheduleRepository = new SyncStorageScheduleRepository()
```

---

## Background ↔ Popup 통신 패턴

```typescript
// Popup → Background: 타이머 시작
chrome.runtime.sendMessage({ type: 'START_TIMER', payload: { noteId, duration } })

// Background → Popup: 상태 업데이트
chrome.runtime.sendMessage({ type: 'TIMER_STATE_UPDATED', payload: timerState })

// Background → Popup: 세션 종료
chrome.runtime.sendMessage({ type: 'SESSION_ENDED', payload: { noteId } })

// Background: 뱃지 업데이트 (내부 호출)
badgeManager.updateBadge(timerState.remaining)
```

---

## 독립 창 모드

```typescript
chrome.windows.create({
  url: chrome.runtime.getURL('index.html'),
  type: 'popup',
  width: 360,
  height: 580,
  focused: true,
})
```
- 팝업: 포커스 잃으면 닫힘 (빠른 확인용)
- 독립 창: 직접 닫기 전까지 유지 (작업 중 띄워두기용)

---

## manifest.json 권한 목록

```json
{
  "manifest_version": 3,
  "permissions": ["alarms", "notifications", "storage", "offscreen"],
  "action": { "default_popup": "popup.html" },
  "background": { "service_worker": "background/index.js" },
  "alarms": {},
  "commands": {
    "_execute_action": { "suggested_key": { "default": "Alt+F" } },
    "start-pause-timer":  { "suggested_key": { "default": "Alt+S" }, "description": "타이머 시작/일시정지" },
    "next-session":       { "suggested_key": { "default": "Alt+N" }, "description": "다음 세션으로" }
  }
}
```

---

## 키보드 단축키 (chrome.commands)

| 단축키 | 동작 |
|--------|------|
| `Alt+F` | FocusCal 팝업 열기 |
| `Alt+S` | 현재 타이머 시작/일시정지 |
| `Alt+N` | 다음 세션으로 건너뛰기 |
