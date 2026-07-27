# 노트 순서 관리 + 휴식 종료 후 다음 노트 자동 진행 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 노트(뽀모도로+일정)에 사용자가 버튼으로 정하는 진행 순서를 도입하고, 휴식 종료 팝업의 "시작하기"가 같은 노트를 재시작하는 대신 순서상 다음 대기(idle) 노트를 시작하도록 바꾼다.

**Architecture:** `BaseNote`에 `order: number`(같은 날짜 그룹 내에서만 비교)를 추가하고, 정렬·다음 노트 탐색·순서 교환 로직을 `src/utils/noteOrder.ts`에 모아 store와 UI가 공유한다. zustand 상태는 그대로 두고 액션(`addNote`, `startNextSession`)과 파생 정렬(`PomodoroNote.tsx`)만 변경한다.

**Tech Stack:** React 18, Zustand 5(+persist), TypeScript(strict), Tailwind 유틸리티 클래스. 테스트 러너 없음.

## Global Constraints

- 모든 응답/커밋 메시지/UI 문구는 한국어 (CLAUDE.md).
- `any` 타입 금지, 명시적 타입만 사용 (CLAUDE.md).
- `console.log` 등 디버그 로그를 남기지 않는다 (CLAUDE.md).
- 컴포넌트/헬퍼 함수는 기존 코드 스타일에 맞춰 `const` 화살표 함수로 작성한다 (feedback 메모리 확인됨).
- 이 프로젝트에는 vitest/jest 등 테스트 러너가 없다. 각 태스크의 검증은 `npx tsc --noEmit -p .`와 `npx eslint <변경 파일>`로 하고, 마지막 태스크 이후 사용자가 직접 확장 프로그램을 로드해 수동 테스트한다.
- **커밋은 사용자의 명시적 요청이 있을 때만 실행한다** (CLAUDE.md "Git" 규칙). 아래 각 태스크의 "Commit" 스텝은 준비된 커밋 메시지이며, 실행 전 반드시 사용자에게 커밋 여부를 확인한다.
- 기존 저장 데이터(chrome.storage에 이미 저장된 노트)에는 `order` 필드가 없다. 새 필드를 읽기 전에 반드시 zustand persist `migrate`로 채워야 한다 — 그냥 옵셔널 체이닝으로 넘어가면 `NaN` 정렬 버그가 난다.

## File Structure

- Create: `src/utils/noteOrder.ts` — 노트 순서 관련 순수 함수(완료 여부 판별, 같은 날짜 활성 노트 정렬, 다음 노트 탐색) 모음.
- Modify: `src/types/note.ts` — `BaseNote`에 `order: number` 추가.
- Modify: `src/store/useAppStore.ts` — persist 마이그레이션, `addNote` order 자동 계산, `moveNoteUp`/`moveNoteDown` 추가, `startNextSession`을 다음 노트 탐색 방식으로 교체.
- Modify: `src/components/NoteBottomSheet.tsx` — 노트 생성 시 `order` 플레이스홀더 값 추가(스토어가 재계산).
- Modify: `src/components/PomodoroNote.tsx` — 정렬 로직을 `order` 기반으로 교체, 카드에 순서 이동 콜백 전달.
- Modify: `src/components/noteCardParts.tsx` — `OrderButtons`(▲▼) UI 추가, `NoteCardFrame`에 순서 이동 props 추가.
- Modify: `src/components/ScheduleNote.tsx` — 순서 이동 props를 `NoteCardFrame`으로 전달.
- Modify: `src/components/SessionEndPopup.tsx` — 다음 노트가 없으면 "시작하기" 버튼 비활성화.

---

### Task 1: `order` 필드 도입 + 기존 데이터 마이그레이션 + 순서 유틸

**Files:**
- Modify: `src/types/note.ts`
- Modify: `src/store/useAppStore.ts`
- Modify: `src/components/NoteBottomSheet.tsx`
- Create: `src/utils/noteOrder.ts`

**Interfaces:**
- Produces: `Note.order: number` (같은 `date` 그룹 내에서만 비교 의미를 가짐)
- Produces (`src/utils/noteOrder.ts`):
  - `isNoteFinished(note: Note): boolean`
  - `activeNotesInDate(notes: Note[], date: string): Note[]` — 같은 날짜의 미완료 노트를 `order` 오름차순 정렬
  - `findNextNote(currentNote: Note, notes: Note[]): Note | null`

- [ ] **Step 1: `BaseNote`에 `order` 필드 추가**

`src/types/note.ts`의 `BaseNote` 인터페이스를 아래와 같이 수정:

```ts
interface BaseNote {
  id: string
  type: NoteType
  title: string
  status: NoteStatus
  createdAt: number
  date: string // 'YYYY-MM-DD' — 날짜 그룹 키
  order: number // 같은 date 그룹 내에서만 비교하는 진행 순서 (작을수록 상단), addNote가 자동 계산
  tagId: string | null
}
```

- [ ] **Step 2: `src/utils/noteOrder.ts` 생성**

```ts
import type { Note } from '../types/note'
import { secondsUntilToday } from './timeUtils'

// 완료(done/failed/skipped) 여부 — 완료된 노트는 순서 재정렬 대상에서 제외되고 항상 하단에 고정됨
export const isNoteFinished = (note: Note): boolean =>
  note.status === 'done' ||
  note.status === 'failed' ||
  note.status === 'skipped'

// 같은 날짜의 미완료 노트를 order 오름차순으로 정렬한 목록
export const activeNotesInDate = (notes: Note[], date: string): Note[] =>
  notes
    .filter(n => n.date === date && !isNoteFinished(n))
    .sort((a, b) => a.order - b.order)

// 일정 노트인데 오늘 종료 시각이 이미 지났는지 — startTimer가 지난 일정을 시작 안 하는 것과 동일 기준
const isPastSchedule = (note: Note): boolean =>
  note.type === 'schedule' && secondsUntilToday(note.endTime) <= 0

// 같은 날짜 그룹에서 currentNote 다음 순서로, 지금 시작 가능한(idle이고 시간이 지나지 않은) 노트
export const findNextNote = (currentNote: Note, notes: Note[]): Note | null =>
  activeNotesInDate(notes, currentNote.date).find(
    n =>
      n.order > currentNote.order &&
      n.status === 'idle' &&
      !isPastSchedule(n),
  ) ?? null
```

- [ ] **Step 3: `useAppStore.ts`에 마이그레이션 헬퍼 추가하고 persist에 연결**

`src/store/useAppStore.ts` 상단 import에 `activeNotesInDate`, `findNextNote` 추가:

```ts
import { activeNotesInDate, findNextNote } from '../utils/noteOrder'
```

`remainingSeconds` 헬퍼 위쪽(파일의 다른 모듈 스코프 헬퍼들과 함께)에 마이그레이션 함수 추가:

```ts
// v0(order 필드 도입 전) 데이터 마이그레이션 — 날짜별로 기존 표시 순서(최신순)를 그대로 order로 치환
const migrateNotesOrder = (notes: Note[]): Note[] => {
  const byDate = new Map<string, Note[]>()
  for (const note of notes) {
    const group = byDate.get(note.date)
    if (group) group.push(note)
    else byDate.set(note.date, [note])
  }
  const orderById = new Map<string, number>()
  for (const group of byDate.values()) {
    const sorted = [...group].sort((a, b) => b.createdAt - a.createdAt)
    sorted.forEach((note, index) => orderById.set(note.id, index))
  }
  return notes.map(n => ({ ...n, order: orderById.get(n.id) ?? 0 }))
}
```

`persist(...)`의 옵션 객체(파일 하단, `name: STORAGE_KEY` 부분)를 아래로 교체:

```ts
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => chromeStorage),
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as {
          notes: Note[]
          timerState: TimerState
          pendingDecision: PendingDecision | null
        }
        return version >= 1
          ? state
          : { ...state, notes: migrateNotesOrder(state.notes ?? []) }
      },
      partialize: state => ({
        notes: state.notes,
        timerState: state.timerState,
        // 팝업이 닫혔다 열려도(OS 알림 클릭 포함) 결정 플로우가 이어지도록 저장
        pendingDecision: state.pendingDecision,
      }),
    },
```

- [ ] **Step 4: `addNote`가 `order`를 자동 계산하도록 수정**

`src/store/useAppStore.ts`의 `addNote` 액션을 아래로 교체:

```ts
      addNote: note =>
        set(s => {
          const siblings = activeNotesInDate(s.notes, note.date)
          const maxOrder = siblings.reduce((max, n) => Math.max(max, n.order), -1)
          return { notes: [...s.notes, { ...note, order: maxOrder + 1 }] }
        }),
```

(전달받은 `note.order`는 무시되고 항상 재계산됨 — 다음 스텝에서 호출부가 플레이스홀더 값을 넘기도록 수정한다.)

- [ ] **Step 5: `NoteBottomSheet.tsx` 호출부에 `order` 플레이스홀더 추가**

`src/components/NoteBottomSheet.tsx`의 `handleSave` 안 `base` 객체를 아래로 교체:

```ts
    const base = {
      id: crypto.randomUUID(),
      title: title.trim() || defaultTitle,
      status: 'idle' as const,
      createdAt: Date.now(),
      date: getTodayDate(),
      order: 0, // addNote가 실제 순서를 재계산해 덮어씀
      tagId,
    }
```

- [ ] **Step 6: 타입체크 + 린트**

Run: `npx tsc --noEmit -p . && npx eslint src/types/note.ts src/utils/noteOrder.ts src/store/useAppStore.ts src/components/NoteBottomSheet.tsx`
Expected: 에러 없이 종료.

- [ ] **Step 7: Commit**

커밋 전 사용자에게 실행 여부 확인.

```bash
git add src/types/note.ts src/utils/noteOrder.ts src/store/useAppStore.ts src/components/NoteBottomSheet.tsx
git commit -m "feat: 노트에 order 필드 도입 및 기존 데이터 마이그레이션"
```

---

### Task 2: 노트 목록 정렬을 `order` 기반으로 교체

**Files:**
- Modify: `src/components/PomodoroNote.tsx`

**Interfaces:**
- Consumes: `isNoteFinished(note: Note): boolean` (Task 1, `src/utils/noteOrder.ts`)

- [ ] **Step 1: `STATUS_ORDER`/로컬 `isFinished` 제거하고 `isNoteFinished` 사용**

`src/components/PomodoroNote.tsx` 상단 import에 추가:

```ts
import { isNoteFinished } from '../utils/noteOrder'
```

아래 블록(`STATUS_ORDER` 상수 + `isFinished` 함수, 38~51행)을 삭제:

```ts
// 정렬 우선순위: 진행/일시정지 → 대기 → 종료 상태
const STATUS_ORDER: Record<NoteStatus, number> = {
  running: 0,
  paused: 0,
  idle: 1,
  done: 2,
  failed: 2,
  skipped: 2,
}

const isFinished = (note: Note): boolean =>
  note.status === 'done' ||
  note.status === 'failed' ||
  note.status === 'skipped'
```

`NoteStatus` 타입 import가 더 이상 이 파일에서 쓰이지 않으면(`status={note.status}` 등 값 사용은 남아있으므로 실제로는 `NoteStatus` 타입 자체를 참조하는 곳이 없어짐) import 문에서 `NoteStatus`를 제거:

```ts
import type { Note, PomodoroNote as PomodoroNoteData } from '../types/note'
```

- [ ] **Step 2: 정렬 로직 교체**

`sortedNotes` 계산부(191~196행)를 아래로 교체:

```ts
  // 날짜 그룹 내: 미완료(order asc) 먼저, 완료는 항상 뒤(최신 완료순)
  const sortedNotes = [...notes].sort((a, b) => {
    const aFinished = isNoteFinished(a)
    const bFinished = isNoteFinished(b)
    if (aFinished !== bFinished) return aFinished ? 1 : -1
    return aFinished ? b.createdAt - a.createdAt : a.order - b.order
  })
```

- [ ] **Step 3: 렌더링에서 `isFinished` 호출을 `isNoteFinished`로 교체**

256행의 `isFinished(note)`를 `isNoteFinished(note)`로 교체.

- [ ] **Step 4: 타입체크 + 린트**

Run: `npx tsc --noEmit -p . && npx eslint src/components/PomodoroNote.tsx`
Expected: 에러 없이 종료.

- [ ] **Step 5: Commit**

커밋 전 사용자에게 실행 여부 확인.

```bash
git add src/components/PomodoroNote.tsx
git commit -m "refactor: 노트 정렬을 order 기반으로 교체"
```

---

### Task 3: `moveNoteUp` / `moveNoteDown` 스토어 액션 추가

**Files:**
- Modify: `src/store/useAppStore.ts`

**Interfaces:**
- Consumes: `activeNotesInDate(notes: Note[], date: string): Note[]` (Task 1)
- Produces: `moveNoteUp: (noteId: string) => void`, `moveNoteDown: (noteId: string) => void` (AppStore 액션)

- [ ] **Step 1: `AppStore` 인터페이스에 액션 시그니처 추가**

`interface AppStore`의 `deleteNote` 아래에 추가:

```ts
  moveNoteUp: (noteId: string) => void
  moveNoteDown: (noteId: string) => void
```

- [ ] **Step 2: `swapOrder` 헬퍼 추가**

`migrateNotesOrder` 아래(모듈 스코프)에 추가:

```ts
// 같은 날짜의 활성 노트 목록에서 noteId를 direction 방향 이웃과 order를 교환
const swapOrder = (notes: Note[], noteId: string, direction: -1 | 1): Note[] => {
  const note = notes.find(n => n.id === noteId)
  if (!note) return notes
  const siblings = activeNotesInDate(notes, note.date)
  const index = siblings.findIndex(n => n.id === noteId)
  const target = siblings[index + direction]
  if (!target) return notes
  return notes.map(n => {
    if (n.id === note.id) return { ...n, order: target.order }
    if (n.id === target.id) return { ...n, order: note.order }
    return n
  })
}
```

- [ ] **Step 3: 액션 구현 추가**

`deleteNote` 액션 바로 아래에 추가:

```ts
      moveNoteUp: noteId => set(s => ({ notes: swapOrder(s.notes, noteId, -1) })),
      moveNoteDown: noteId => set(s => ({ notes: swapOrder(s.notes, noteId, 1) })),
```

- [ ] **Step 4: 타입체크 + 린트**

Run: `npx tsc --noEmit -p . && npx eslint src/store/useAppStore.ts`
Expected: 에러 없이 종료.

- [ ] **Step 5: Commit**

커밋 전 사용자에게 실행 여부 확인.

```bash
git add src/store/useAppStore.ts
git commit -m "feat: moveNoteUp/moveNoteDown 액션 추가"
```

---

### Task 4: ▲▼ 순서 이동 버튼 UI

**Files:**
- Modify: `src/components/noteCardParts.tsx`
- Modify: `src/components/PomodoroNote.tsx`
- Modify: `src/components/ScheduleNote.tsx`

**Interfaces:**
- Consumes: `moveNoteUp(noteId: string)`, `moveNoteDown(noteId: string)` (Task 3), `isNoteFinished` (Task 1)
- Produces: `NoteCardFrame`의 새 필수 props `canMoveUp: boolean`, `canMoveDown: boolean`, `onMoveUp: () => void`, `onMoveDown: () => void`

- [ ] **Step 1: `noteCardParts.tsx`에 `OrderButtons` 추가**

`ActionButton` 컴포넌트 아래(72행 이후, `finishedSummary` 위)에 추가:

```tsx
// 노트 순서 이동 — 같은 날짜의 미완료 노트 사이에서만 이동 가능
const OrderButtons = ({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) => (
  <div className="flex flex-col shrink-0">
    <button
      onClick={onMoveUp}
      disabled={!canMoveUp}
      aria-label="위로 이동"
      className="w-5 h-4 flex items-center justify-center border-0 outline-none cursor-pointer bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 transition-all duration-150"
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 15l7-7 7 7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
    <button
      onClick={onMoveDown}
      disabled={!canMoveDown}
      aria-label="아래로 이동"
      className="w-5 h-4 flex items-center justify-center border-0 outline-none cursor-pointer bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 transition-all duration-150"
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
        <path
          d="M19 9l-7 7-7-7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  </div>
)
```

- [ ] **Step 2: `NoteCardFrame`에 props 추가하고 헤더에 `OrderButtons` 배치**

`NoteCardFrame`의 props 타입(154~167행)에 추가:

```ts
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
```

구조분해 인자 목록에도 `canMoveUp, canMoveDown, onMoveUp, onMoveDown` 추가.

헤더 블록(188~197행)을 아래로 교체:

```tsx
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TypeBadge type={type} />
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: STATUS_DOT[status] }}
          />
        </div>
        <div className="flex items-center gap-1">
          <OrderButtons
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
          />
          <DeleteButton onClick={onDeleteRequest} />
        </div>
      </div>
```

- [ ] **Step 3: `PomodoroCard`가 이동 props를 받아 `NoteCardFrame`에 전달**

`src/components/PomodoroNote.tsx`의 `PomodoroCard` props 타입(103~110행)에 추가:

```ts
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
```

구조분해 인자에도 추가하고, `<NoteCardFrame ...>` 호출(136~180행)에 그대로 전달:

```tsx
    <NoteCardFrame
      type="pomodoro"
      status={note.status}
      title={note.title}
      subtitle={`${formatDuration(note.workDuration)} 집중 · ${formatDuration(note.breakDuration)} 휴식`}
      display={formatTime(remaining)}
      progress={progress}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      infoLeft={
```

(기존 `infoLeft` 이하 블록은 그대로 유지)

- [ ] **Step 4: `ScheduleNoteCard`도 동일하게 전달**

`src/components/ScheduleNote.tsx`의 props 타입(10~18행)에 추가:

```ts
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
```

구조분해 인자에 추가하고 `<NoteCardFrame ...>` 호출(29~51행)에 전달:

```tsx
    <NoteCardFrame
      type="schedule"
      status={note.status}
      title={note.title}
      subtitle={`${note.startTime} — ${note.endTime} · ${duration}`}
      display={isRunning ? formatTime(timer.remaining) : '시작 대기 중'}
      displayMuted={!isRunning}
      progress={progress}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      infoLeft={isRunning ? `${note.endTime} 종료` : `${note.startTime} 시작`}
```

- [ ] **Step 5: `PomodoroNote.tsx`에서 날짜별 활성 노트 순서를 계산해 카드에 전달**

`PomodoroNote` 컴포넌트 상단에 스토어 액션 추가:

```ts
  const moveNoteUp = useAppStore(s => s.moveNoteUp)
  const moveNoteDown = useAppStore(s => s.moveNoteDown)
```

렌더링 부분(250~278행, `{dates.map(date => (...))}`)을 아래로 교체:

```tsx
        {dates.map(date => {
          const groupNotes = notesByDate.get(date) ?? []
          const activeIds = groupNotes
            .filter(n => !isNoteFinished(n))
            .map(n => n.id)
          return (
            <div key={date} className="flex flex-col gap-2.5">
              <DateHeading date={date} />
              {groupNotes.map(note => {
                if (isNoteFinished(note))
                  return (
                    <FinishedNoteRow
                      key={note.id}
                      note={note}
                      onDeleteRequest={() => setDeleteTarget(note)}
                    />
                  )
                const index = activeIds.indexOf(note.id)
                const moveProps = {
                  canMoveUp: index > 0,
                  canMoveDown: index < activeIds.length - 1,
                  onMoveUp: () => moveNoteUp(note.id),
                  onMoveDown: () => moveNoteDown(note.id),
                }
                return note.type === 'pomodoro' ? (
                  <PomodoroCard
                    key={note.id}
                    note={note}
                    timer={timer}
                    onDeleteRequest={() => setDeleteTarget(note)}
                    {...moveProps}
                  />
                ) : (
                  <ScheduleNoteCard
                    key={note.id}
                    note={note}
                    timer={timer}
                    onDeleteRequest={() => setDeleteTarget(note)}
                    {...moveProps}
                  />
                )
              })}
            </div>
          )
        })}
```

- [ ] **Step 6: 타입체크 + 린트**

Run: `npx tsc --noEmit -p . && npx eslint src/components/noteCardParts.tsx src/components/PomodoroNote.tsx src/components/ScheduleNote.tsx`
Expected: 에러 없이 종료.

- [ ] **Step 7: Commit**

커밋 전 사용자에게 실행 여부 확인.

```bash
git add src/components/noteCardParts.tsx src/components/PomodoroNote.tsx src/components/ScheduleNote.tsx
git commit -m "feat: 노트 카드에 순서 이동(▲▼) 버튼 추가"
```

---

### Task 5: 휴식 종료 후 "다음 노트" 자동 시작 (+ 현재 노트 자동 완료)

**Files:**
- Modify: `src/store/useAppStore.ts`

**Interfaces:**
- Consumes: `findNextNote(currentNote: Note, notes: Note[]): Note | null` (Task 1)

- [ ] **Step 1: `startNextSession` 교체**

`src/store/useAppStore.ts`의 `startNextSession` 액션(309~326행)을 아래로 교체:

```ts
      // [시작하기] — 휴식 종료 응답에서 순서상 다음 노트를 시작. 현재 노트는 done으로 자동 완료.
      startNextSession: () => {
        const { pendingDecision, notes } = get()
        if (pendingDecision?.kind !== 'breakEnd') return
        const note = notes.find(n => n.id === pendingDecision.noteId)
        if (!note || note.type !== 'pomodoro') return
        const nextNote = findNextNote(note, notes)
        if (!nextNote) return
        const total =
          nextNote.type === 'pomodoro'
            ? nextNote.workDuration * 60
            : secondsUntilToday(nextNote.endTime)
        set(s => ({
          notes: s.notes.map(n => {
            if (n.id === note.id) return { ...n, status: 'done' as const }
            if (n.id === nextNote.id)
              return {
                ...n,
                status: 'running' as const,
                ...(n.type === 'pomodoro' ? { suspendedTimer: null } : {}),
              }
            return n
          }),
          timerState: {
            noteId: nextNote.id,
            phase: 'work' as TimerPhase,
            isRunning: true,
            total,
            remaining: total,
            endsAt: Date.now() + total * 1000,
          },
          pendingDecision: null,
        }))
      },
```

- [ ] **Step 2: 타입체크 + 린트**

Run: `npx tsc --noEmit -p . && npx eslint src/store/useAppStore.ts`
Expected: 에러 없이 종료.

- [ ] **Step 3: Commit**

커밋 전 사용자에게 실행 여부 확인.

```bash
git add src/store/useAppStore.ts
git commit -m "feat: 휴식 종료 시 같은 노트 재시작 대신 다음 노트를 시작하도록 변경"
```

---

### Task 6: 다음 노트가 없으면 "시작하기" 버튼 비활성화

**Files:**
- Modify: `src/components/SessionEndPopup.tsx`

**Interfaces:**
- Consumes: `findNextNote(currentNote: Note, notes: Note[]): Note | null` (Task 1)

- [ ] **Step 1: `findNextNote` import 및 `hasNextNote` 계산**

`src/components/SessionEndPopup.tsx` 상단 import에 추가:

```ts
import { findNextNote } from '../utils/noteOrder'
```

`PopupContent` props 타입(21~27행)에 `hasNextNote: boolean` 추가:

```ts
const PopupContent = ({
  note,
  kind,
  hasNextNote,
}: {
  note: PomodoroNote
  kind: PendingDecision['kind']
  hasNextNote: boolean
}) => {
```

"시작하기" 버튼(116~121행)을 아래로 교체:

```tsx
              <button
                onClick={startNextSession}
                disabled={!hasNextNote}
                className={buttonClass('accent')}
              >
                시작하기
              </button>
```

`SessionEndPopup` 컴포넌트(131~144행)를 아래로 교체:

```tsx
const SessionEndPopup = () => {
  const decision = useAppStore(s => s.pendingDecision)
  const notes = useAppStore(s => s.notes)
  const note = notes.find(n => n.id === decision?.noteId)

  if (!decision || !note || note.type !== 'pomodoro') return null
  const hasNextNote =
    decision.kind !== 'breakEnd' || findNextNote(note, notes) !== null
  return (
    <PopupContent
      key={`${note.id}-${decision.kind}`}
      note={note}
      kind={decision.kind}
      hasNextNote={hasNextNote}
    />
  )
}
```

- [ ] **Step 2: 타입체크 + 린트**

Run: `npx tsc --noEmit -p . && npx eslint src/components/SessionEndPopup.tsx`
Expected: 에러 없이 종료.

- [ ] **Step 3: Commit**

커밋 전 사용자에게 실행 여부 확인.

```bash
git add src/components/SessionEndPopup.tsx
git commit -m "fix: 다음 노트가 없으면 휴식종료 팝업의 시작하기 버튼을 비활성화"
```

---

## 최종 수동 검증 (사용자 직접 진행)

Task 6까지 끝나면 아래를 사용자가 직접 확장 프로그램을 로드해 확인한다 (테스트 러너가 없으므로 유일한 실제 검증 경로):

1. `npm run dev`(또는 `npm run build`)로 빌드하고 크롬에 `.output/chrome-mv3-dev`(또는 `chrome-mv3`)를 로드.
2. 같은 날짜에 뽀모도로 노트 2개 이상 생성 → ▲▼ 버튼으로 순서 변경이 화면에 즉시 반영되는지 확인.
3. 완료(그만하기/넘기기 등)된 노트가 항상 맨 아래 고정되고 ▲▼ 버튼이 안 보이는지 확인.
4. 노트 A(집중 2분/휴식 1분 정도로 짧게 설정)를 시작 → 집중 종료 → "네" → 휴식 종료까지 기다림 → 팝업에서 "시작하기"를 눌렀을 때, 순서상 다음 idle 노트(B)가 시작되고 A는 "완료" 상태로 바뀌는지 확인.
5. 다음 idle 노트가 하나도 없는 상태에서 동일한 플로우를 밟아 "시작하기" 버튼이 비활성화되는지 확인.
6. 일정(schedule) 노트가 다음 순서에 있을 때도 정상적으로 시작되는지 확인.
