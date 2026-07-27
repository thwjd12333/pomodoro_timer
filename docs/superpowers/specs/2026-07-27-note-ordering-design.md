# 노트 순서 관리 + 휴식 종료 후 다음 노트 자동 진행

## 배경

휴식이 끝나면 뜨는 `SessionEndPopup`의 breakEnd 단계 "시작하기" 버튼(`startNextSession`, `useAppStore.ts`)은
현재 항상 **같은 노트**의 work 단계를 재시작한다. 등록된 다른 노트가 있든 없든 동일하게 동작해
사용자가 의도한 "다음 노트로 진행"이 되지 않는다.

또한 노트 목록에는 사용자가 임의로 진행 순서를 정할 수 있는 수단이 없다. 화면 표시 순서는
`status`(진행중/대기/완료)와 `createdAt`으로만 파생되며(`PomodoroNote.tsx`), 별도의 순서 필드가 없다.

## 목표

1. 노트(뽀모도로 + 일정 공통)에 사용자가 직접 정하는 진행 순서를 도입한다.
2. 순서는 날짜(`date`) 그룹 내에서만 의미를 가진다.
3. 완료된 노트(done/failed/skipped)는 항상 그룹 최하단에 고정되고, 순서 변경 대상에서 제외된다.
4. 휴식 종료 팝업의 "시작하기"는 같은 날짜 그룹에서 현재 노트 다음 순서의 대기(idle) 노트를 시작한다.
5. 다음 노트가 없으면 "시작하기" 버튼을 비활성화한다.

## 범위 밖 (Out of scope)

- 드래그 앤 드롭 순서 변경 (버튼 방식만 구현)
- "완료"(`finishNote`) / "넘기기"(`skipEndedNote`) 흐름에서의 자동 다음 노트 진행
- 다음 노트의 이름을 버튼 라벨에 미리 노출하는 것
- 날짜 그룹을 넘나드는 순서/자동 진행

## 설계

### 1. 데이터 모델

`src/types/note.ts`의 `BaseNote`에 필드 추가:

```ts
interface BaseNote {
  // ...기존 필드
  order: number // 같은 date 그룹 내에서만 비교되는 진행 순서 (작을수록 상단)
}
```

노트 생성(`addNote`, `useAppStore.ts`) 시: 같은 `date`의 미완료(active: idle/running/paused) 노트 중
가장 큰 `order` + 1을 부여. 같은 날짜에 미완료 노트가 없으면 0.

### 2. 정렬 로직 변경 (`PomodoroNote.tsx`)

기존:
```ts
const STATUS_ORDER: Record<NoteStatus, number> = {
  running: 0, paused: 0, idle: 1, done: 2, failed: 2, skipped: 2,
}
const sortedNotes = [...notes].sort(
  (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt - a.createdAt,
)
```

변경: 날짜 그룹 내에서
- 미완료(idle/running/paused) 그룹: `order` 오름차순.
- 완료(done/failed/skipped) 그룹: 항상 미완료 그룹 뒤. 그룹 내부는 기존처럼 `createdAt` 내림차순 유지 (재정렬 대상 아님).

`STATUS_ORDER`를 "미완료(0)/완료(1)" 2단계로 단순화하고, 동률 시 비교자를 상태별로 분기한다
(미완료: `order` asc, 완료: `createdAt` desc).

### 3. 순서 변경 UI

- 각 미완료 노트 카드에 ▲▼ 버튼 추가 (`noteCardParts.tsx` 또는 `PomodoroNote.tsx`의 카드 렌더링 부분).
- 완료된 노트 카드(`FinishedNoteRow`)에는 버튼 표시 안 함.
- 같은 날짜의 미완료 노트 리스트 기준 인접한 두 노트의 `order` 값을 swap.
- 리스트의 첫 번째 항목은 ▲ 비활성화, 마지막 항목은 ▼ 비활성화.

`useAppStore.ts`에 액션 추가:
```ts
moveNoteUp: (noteId: string) => void
moveNoteDown: (noteId: string) => void
```
같은 `date` + 미완료 상태인 노트들만 대상으로 정렬한 배열에서 현재 노트의 인접 노트를 찾아
두 노트의 `order`를 교환.

### 4. 휴식 종료 팝업 동작 변경

공통 헬퍼 `findNextNote(currentNote, notes)`를 하나 두고, disabled 계산과 실제 시작 로직이 **동일한 함수**를
공유한다 (로직 중복/드리프트 방지):

```ts
// 같은 date, status === 'idle', order > currentNote.order인 노트를 order 오름차순으로 순회하며
// "시작 가능한" 첫 노트를 반환. 일정 노트인데 이미 종료 시각이 지난 경우(secondsUntilToday(endTime) <= 0)는
// 건너뛰고 그다음 순서의 idle 노트를 계속 확인한다. 끝까지 없으면 null.
const findNextNote = (currentNote: Note, notes: Note[]): Note | null => { ... }
```

`startNextSession` (`useAppStore.ts:309`) 변경:
- 기존: `note.workDuration * 60`으로 같은 노트를 work 단계로 재시작.
- 변경:
  1. `pendingDecision.noteId`의 노트(A)를 찾음 (기존과 동일).
  2. `findNextNote`로 다음 노트(B)를 찾음.
  3. 다음 노트가 있으면: **A는 `status: 'done'`으로 자동 완료 처리**하고, B에 대해 기존 `startTimer`와
     동일한 초기화 로직 수행(`type`에 따라 `workDuration*60` 또는 `secondsUntilToday(endTime)`; 뽀모도로/일정 공통).
     A를 다시 시작하려면 사용자가 새 노트를 만들어야 한다.
  4. 다음 노트가 없으면: 아무 동작도 하지 않음(no-op) — 버튼이 애초에 비활성화되어 호출되지 않아야 하므로 방어적으로만 처리.

`SessionEndPopup.tsx`에서 breakEnd 단계 렌더링 시 동일한 `findNextNote`를 호출해 결과가 `null`이면
"시작하기" 버튼을 `disabled` 처리한다.

### 5. 예외 케이스

- 다음 노트가 일정(schedule) 타입인데 이미 종료 시각이 지난 경우는 `findNextNote` 내부에서 건너뛰고
  그다음 순서의 idle 노트를 계속 탐색한다 (4번 참고).
- 노트가 삭제되어 `order`에 빈 구간이 생겨도 정렬에는 영향 없음(상대적 크기만 비교).

## 영향 파일

- `src/types/note.ts` — `order` 필드 추가
- `src/store/useAppStore.ts` — `addNote`, `startNextSession`, `moveNoteUp`/`moveNoteDown` 추가
- `src/components/PomodoroNote.tsx` — 정렬 로직 변경, 다음 노트 존재 여부 계산
- `src/components/noteCardParts.tsx` — ▲▼ 버튼 UI 추가
- `src/components/SessionEndPopup.tsx` — "시작하기" 버튼 disabled 처리
