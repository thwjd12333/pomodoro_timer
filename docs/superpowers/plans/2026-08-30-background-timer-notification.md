# 백그라운드 타이머 알림 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 크롬 창이 최소화/비활성 상태여도 타이머 종료 시점에 OS 알림과 사운드가 발송되도록, 종료 알림 소유권을 팝업에서 백그라운드 서비스 워커로 이전한다.

**Architecture:** 팝업의 `setInterval` 대신 백그라운드가 `chrome.alarms`로 `endsAt` 시점에 깨어나 알림을 발송한다. 서비스 워커는 Web Audio를 못 쓰므로 offscreen 문서를 통해 소리를 재생한다. 알람 발화 시점에 팝업이 이미 상태를 전환했을 수 있으므로, 예약 시점의 판별 정보(`phase` 등)를 `chrome.storage.session`에 따로 저장한다.

**Tech Stack:** WXT 0.20, TypeScript(strict), Zustand persist(`chrome.storage.sync`), `chrome.alarms` / `chrome.notifications` / `chrome.offscreen` / `chrome.storage.session`.

## Global Constraints

- 모든 응답/커밋 메시지는 한국어. 커밋 메시지는 Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:` …).
- `any` 타입 금지. 명시적·정밀한 타입만.
- 프로덕션 코드에 `console.log` 금지.
- 함수/컴포넌트는 단일 책임. 죽은 코드·미사용 변수·중복 로직 금지.
- 기존 코드 스타일/패턴을 그대로 따른다 (화살표 함수 `const` 선호, 한국어 주석으로 "왜"를 설명).
- 이 프로젝트에는 테스트 러너가 없다. 테스트 프레임워크를 새로 도입하지 않는다. 검증은 순수 함수의 일회성 `node` 확인 + `npm run lint` + `npx wxt build` + 수동 시나리오로 한다.
- `noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch` 활성. 미사용 import 남기지 말 것.
- 커밋은 각 Task 끝에서 한 번. 사용자가 별도로 막지 않는 한 Task 완료 시 커밋한다.

---

## File Structure

| 파일 | 책임 | 상태 |
|---|---|---|
| `src/utils/notifyEvents.ts` | 알림 이벤트 타입 + 이벤트별 메시지·사운드 테이블 (단일 출처) | 신규 (기존 `notifier.ts`에서 추출) |
| `src/utils/notifier.ts` | 팝업 컨텍스트 알림 발송 (`scheduleStart` 등). 테이블은 `notifyEvents`에서 import | 수정 |
| `entrypoints/offscreen/index.html` | offscreen 문서 셸 | 신규 |
| `entrypoints/offscreen/main.ts` | `play-sound` 메시지 수신 → 기존 `playSound()` 호출 | 신규 |
| `src/background/phaseNotifier.ts` | 종료 이벤트 판별 + OS 알림 + offscreen 사운드 요청 + offscreen 문서 lifecycle | 신규 |
| `entrypoints/background.ts` | `syncAlarm()` + `timer-end` 알람 처리 추가 | 수정 |
| `src/store/useAppStore.ts` | `advancePhase()`의 종료 `notify()` 2곳 제거 | 수정 |
| `docs/superpowers/specs/2026-08-30-background-timer-notification-design.md` | 설계 문서 | 기존 |

---

## Task 1: 알림 이벤트 테이블을 공유 모듈로 추출

**Files:**
- Create: `src/utils/notifyEvents.ts`
- Modify: `src/utils/notifier.ts:1-21`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `export type NotifyEventType = 'sessionComplete' | 'breakEnd' | 'scheduleStart' | 'scheduleEnd'`
  - `export const EVENTS: Record<NotifyEventType, { message: string; sound: SoundType }>`

- [ ] **Step 1: `src/utils/notifyEvents.ts` 생성**

`src/utils/notifier.ts`에 있던 타입과 테이블을 그대로 옮긴다. 값은 한 글자도 바꾸지 않는다.

```ts
import type { SoundType } from './soundUtils'

export type NotifyEventType =
  | 'sessionComplete'
  | 'breakEnd'
  | 'scheduleStart'
  | 'scheduleEnd'

// 알림 통합 테이블 — 이벤트별 메시지·사운드. 팝업(notifier)과 백그라운드(phaseNotifier)가 공유
export const EVENTS: Record<
  NotifyEventType,
  { message: string; sound: SoundType }
> = {
  sessionComplete: {
    message: '집중 세션이 끝났어요. 일정을 완료하셨나요?',
    sound: 'bell',
  },
  breakEnd: {
    message: '휴식이 끝났어요. 다음 세션을 시작할까요?',
    sound: 'soft',
  },
  scheduleStart: { message: '일정을 시작해요.', sound: 'chime' },
  scheduleEnd: { message: '일정 시간이 끝났어요.', sound: 'bell' },
}
```

- [ ] **Step 2: `src/utils/notifier.ts` 를 공유 모듈 사용으로 변경**

파일 전체를 아래로 교체한다 (타입/테이블 정의를 제거하고 import).

```ts
import { EVENTS, type NotifyEventType } from './notifyEvents'
import { playSound } from './soundUtils'

export type { NotifyEventType }

// OS 알림과 사운드를 노트별 설정에 따라 발송하는 단일 진입점 (팝업 컨텍스트 전용)
export const notify = (
  type: NotifyEventType,
  noteTitle: string,
  channels: { os: boolean; sound: boolean },
): void => {
  if (channels.os)
    void chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('/icons/icon128.png'),
      title: noteTitle,
      message: EVENTS[type].message,
    })
  if (channels.sound) playSound(EVENTS[type].sound)
}
```

- [ ] **Step 3: 참조가 깨지지 않았는지 확인**

Run: `grep -rn "from '.*notifier'" src entrypoints`
Expected: `src/store/useAppStore.ts` 만 `notify` 를 import 하며, `import { notify } from '../utils/notifier'` 형태 그대로 유효.

- [ ] **Step 4: lint + build**

Run: `npm run lint && npx wxt build`
Expected: 에러 없이 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/utils/notifyEvents.ts src/utils/notifier.ts
git commit -m "refactor: 알림 이벤트 테이블을 notifyEvents 모듈로 추출"
```

---

## Task 2: offscreen 오디오 문서 추가

**Files:**
- Create: `entrypoints/offscreen/index.html`
- Create: `entrypoints/offscreen/main.ts`

**Interfaces:**
- Consumes: `playSound` from `src/utils/soundUtils.ts`, `SoundType` from same
- Produces:
  - 빌드 산출물 `offscreen.html` (WXT unlisted-page 규칙: `entrypoints/offscreen/index.html` → `offscreen.html`)
  - `chrome.runtime` 메시지 계약: `{ type: 'play-sound'; sound: SoundType }` 수신 시 해당 사운드 재생

- [ ] **Step 1: `entrypoints/offscreen/index.html` 생성**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <title>FocusCal Offscreen</title>
  </head>
  <body>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: `entrypoints/offscreen/main.ts` 생성**

```ts
import { playSound, type SoundType } from '../../src/utils/soundUtils'

interface PlaySoundMessage {
  type: 'play-sound'
  sound: SoundType
}

// 백그라운드가 보내는 알림음 재생 요청만 처리 — 서비스 워커는 Web Audio를 직접 쓸 수 없음
const isPlaySoundMessage = (message: unknown): message is PlaySoundMessage =>
  typeof message === 'object' &&
  message !== null &&
  (message as { type?: unknown }).type === 'play-sound'

chrome.runtime.onMessage.addListener(message => {
  if (isPlaySoundMessage(message)) playSound(message.sound)
})
```

- [ ] **Step 3: build 로 산출물 확인**

Run: `npx wxt build && ls .output/chrome-mv3/offscreen.html`
Expected: `offscreen.html` 존재. `npx wxt build` 자체도 에러 없이 통과.

- [ ] **Step 4: lint**

Run: `npm run lint`
Expected: 통과.

- [ ] **Step 5: 커밋**

```bash
git add entrypoints/offscreen/index.html entrypoints/offscreen/main.ts
git commit -m "feat: 백그라운드 알림음 재생용 offscreen 문서 추가"
```

---

## Task 3: phaseNotifier 모듈 (이벤트 판별 + 알림 + offscreen 사운드)

**Files:**
- Create: `src/background/phaseNotifier.ts`

**Interfaces:**
- Consumes:
  - `EVENTS`, `NotifyEventType` from `src/utils/notifyEvents.ts`
  - `Note` from `src/types/note.ts`, `TimerPhase` from `src/types/timer.ts`
- Produces:
  - `export const resolvePhaseEndEvent = (noteType: Note['type'], phase: TimerPhase): NotifyEventType`
  - `export const notifyPhaseEnd = (note: Note, phase: TimerPhase): Promise<void>`

- [ ] **Step 1: `src/background/phaseNotifier.ts` 생성**

`src/background/badgeManager.ts`와 같은 "백그라운드 전용 단일 책임 모듈" 패턴.

```ts
import type { Note } from '../types/note'
import type { TimerPhase } from '../types/timer'
import { EVENTS, type NotifyEventType } from '../utils/notifyEvents'

const OFFSCREEN_URL = 'offscreen.html'

// (노트 타입, 단계) → 종료 이벤트. 일정 노트는 단계 구분 없이 종료로 처리
export const resolvePhaseEndEvent = (
  noteType: Note['type'],
  phase: TimerPhase,
): NotifyEventType =>
  noteType === 'schedule'
    ? 'scheduleEnd'
    : phase === 'work'
      ? 'sessionComplete'
      : 'breakEnd'

// 오디오 재생용 offscreen 문서를 하나만 유지 — 동시 생성 요청은 하나의 Promise로 직렬화
let creating: Promise<void> | null = null
const ensureOffscreenDocument = async (): Promise<void> => {
  if (await chrome.offscreen.hasDocument()) return
  if (!creating)
    creating = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: ['AUDIO_PLAYBACK'],
        justification: '타이머 종료 알림음 재생',
      })
      .finally(() => {
        creating = null
      })
  await creating
}

// 종료 이벤트별 노트 채널 설정 — 뽀모도로는 complete, 일정은 end 필드를 사용
const channelsFor = (note: Note): { os: boolean; sound: boolean } =>
  note.type === 'pomodoro'
    ? { os: note.notifyOnComplete, sound: note.soundOnComplete }
    : { os: note.notifyOnEnd, sound: note.soundOnEnd }

// 백그라운드에서 타이머 종료를 알림 — OS 알림은 직접, 사운드는 offscreen 경유
export const notifyPhaseEnd = async (
  note: Note,
  phase: TimerPhase,
): Promise<void> => {
  const event = resolvePhaseEndEvent(note.type, phase)
  const channels = channelsFor(note)

  if (channels.os)
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('/icons/icon128.png'),
      title: note.title,
      message: EVENTS[event].message,
    })

  if (channels.sound) {
    await ensureOffscreenDocument()
    // offscreen 리스너가 아직 없더라도 실패가 전체 흐름을 막지 않도록 방어
    void chrome.runtime
      .sendMessage({ type: 'play-sound', sound: EVENTS[event].sound })
      .catch(() => undefined)
  }
}
```

- [ ] **Step 2: 순수 함수 동작을 일회성으로 확인**

Run:
```bash
npx tsx -e "import('./src/background/phaseNotifier.ts').then(m => { const r = ['schedule','pomodoro'].flatMap(t => ['work','break'].map(p => t+'/'+p+' => '+m.resolvePhaseEndEvent(t, p))); console.log(r.join('\n')) })" 2>/dev/null || node --experimental-strip-types -e "const {resolvePhaseEndEvent}=await import('./src/background/phaseNotifier.ts'); console.log(resolvePhaseEndEvent('pomodoro','work'), resolvePhaseEndEvent('pomodoro','break'), resolvePhaseEndEvent('schedule','work'))"
```
Expected 출력에 다음이 포함:
- `pomodoro/work => sessionComplete`
- `pomodoro/break => breakEnd`
- `schedule/work => scheduleEnd`
- `schedule/break => scheduleEnd`

(둘 다 실행 불가한 환경이면 이 스텝은 건너뛰고 Step 3의 타입체크로 대체 — `resolvePhaseEndEvent`는 한눈에 검증 가능한 3분기 순수 함수다.)

- [ ] **Step 3: lint + build**

Run: `npm run lint && npx wxt build`
Expected: 통과. (아직 어디서도 import 하지 않으므로 `noUnusedLocals`와 무관하게 export 는 허용됨.)

- [ ] **Step 4: 커밋**

```bash
git add src/background/phaseNotifier.ts
git commit -m "feat: 백그라운드 타이머 종료 알림 모듈(phaseNotifier) 추가"
```

---

## Task 4: background 에 알람 예약·발화 처리 추가

**Files:**
- Modify: `entrypoints/background.ts`

**Interfaces:**
- Consumes: `notifyPhaseEnd` from `src/background/phaseNotifier.ts`, `TimerPhase` from `src/types/timer.ts`
- Produces: 없음 (엔트리포인트)

- [ ] **Step 1: import 와 상수 추가**

`entrypoints/background.ts` 상단, 기존 import 블록에 추가:

```ts
import type { TimerPhase } from '../src/types/timer'
import { notifyPhaseEnd } from '../src/background/phaseNotifier'
```

기존 상수 아래(`const BADGE_ALARM = 'badge-refresh'` 다음 줄)에 추가:

```ts
const TIMER_ALARM = 'timer-end'
const ALARM_CONTEXT_KEY = 'timerAlarmContext'

// 알람은 페이로드를 실을 수 없고, 발화 시점엔 팝업이 이미 timerState 를 비웠을 수 있어
// 예약 시점의 판별 정보를 storage.session 에 따로 보관한다
interface TimerAlarmContext {
  noteId: string
  phase: TimerPhase
  endsAt: number
}
```

- [ ] **Step 2: `syncAlarm()` 함수 추가**

`refreshBadge` 함수 정의 바로 아래에 추가:

```ts
const readAlarmContext = async (): Promise<TimerAlarmContext | undefined> => {
  const stored = await chrome.storage.session.get(ALARM_CONTEXT_KEY)
  return stored[ALARM_CONTEXT_KEY] as TimerAlarmContext | undefined
}

// 진행 중이면 endsAt 시점에 timer-end 알람을 예약하고, 아니면 정리한다.
// 단, 만료가 이미 일어난 직후라면(팝업이 먼저 단계를 전환한 경우) 예약된 알람이
// 한 번 발화하도록 남겨둔다 — handleTimerEnd 가 발화 후 컨텍스트를 제거한다.
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
```

- [ ] **Step 3: `handleTimerEnd()` 함수 추가**

`syncAlarm` 아래에 추가:

```ts
// timer-end 알람 발화 → 예약 컨텍스트로 종료 이벤트를 판별해 알림 발송 (1회성)
const handleTimerEnd = async (): Promise<void> => {
  const context = await readAlarmContext()
  await chrome.storage.session.remove(ALARM_CONTEXT_KEY)
  if (!context || Date.now() < context.endsAt - 2000) return

  const note = (await readAppState())?.notes.find(n => n.id === context.noteId)
  if (!note) return

  await notifyPhaseEnd(note, context.phase)
}
```

- [ ] **Step 4: 리스너 등록부 수정**

`defineBackground` 콜백 안에서:

`chrome.storage.onChanged` 리스너를 수정 — sync/STORAGE_KEY 변경 시 뱃지와 알람을 함께 갱신:

```ts
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes[STORAGE_KEY]) {
      void refreshBadge()
      void syncAlarm()
    }
  })
```

`chrome.alarms.onAlarm` 리스너에 `TIMER_ALARM` 분기 추가:

```ts
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === BADGE_ALARM) void refreshBadge()
    if (alarm.name === TIMER_ALARM) void handleTimerEnd()
  })
```

콜백 마지막의 startup 복원부 수정:

```ts
  // 브라우저 시작·서비스 워커 재기동 시 상태 복원
  void refreshBadge()
  void syncAlarm()
```

- [ ] **Step 5: lint + build**

Run: `npm run lint && npx wxt build`
Expected: 통과. `.output/chrome-mv3/background.js` 재생성.

- [ ] **Step 6: 수동 검증 (dev 로드)**

Run: `npm run dev` (고정 프로필로 크롬이 뜸)

1. 뽀모도로 노트를 만들고 `workDuration` 을 1분으로 설정 → 타이머 시작.
2. 크롬 창을 최소화한다.
3. 1분 후 OS 알림(제목=노트 제목, 본문="집중 세션이 끝났어요…")과 `bell` 소리가 나는지 확인.
4. 크롬을 복원하고 팝업을 열면 `SessionEndPopup` 이 뜬다. 이 시점에는 **알림이 한 번 더 오는 것이 정상**이다(Task 5에서 팝업 경로 알림을 제거하기 전이므로). Task 5 이후 재확인.

- [ ] **Step 7: 커밋**

```bash
git add entrypoints/background.ts
git commit -m "feat: 백그라운드에서 chrome.alarms로 타이머 종료 알림 예약·발송"
```

---

## Task 5: store 의 종료 알림 호출 제거

**Files:**
- Modify: `src/store/useAppStore.ts:242-284`

**Interfaces:**
- Consumes: 없음 (기존 `notify` import 는 `startTimer`/`startNextSession` 의 `scheduleStart` 발송에 계속 사용)
- Produces: 없음

- [ ] **Step 1: `advancePhase()` 의 schedule 분기에서 `notify('scheduleEnd', …)` 제거**

`advancePhase` 안, schedule 분기가 현재 이렇게 되어 있다:

```ts
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
```

`notify(...)` 호출 4줄을 삭제해 아래처럼 만든다:

```ts
        if (note.type === 'schedule') {
          set(s => ({
            notes: s.notes.map(n =>
              n.id === note.id ? { ...n, status: 'done' as const } : n,
            ),
            timerState: IDLE_TIMER_STATE,
          }))
          return
        }
```

- [ ] **Step 2: `advancePhase()` 의 pomodoro 분기 끝에서 `notify(...)` 제거**

현재 `advancePhase` 는 pomodoro 분기 `set(...)` 다음에 이렇게 끝난다:

```ts
        notify(
          kind === 'sessionEnd' ? 'sessionComplete' : 'breakEnd',
          note.title,
          {
            os: note.notifyOnComplete,
            sound: note.soundOnComplete,
          },
        )
      },
```

`notify(...)` 호출 전체(7줄)를 삭제해 `set(...)` 직후 함수가 끝나도록 한다:

```ts
          pendingDecision: { noteId: note.id, kind },
        }))
      },
```

- [ ] **Step 3: `notify` import 가 여전히 쓰이는지 확인**

Run: `grep -n "notify(" src/store/useAppStore.ts`
Expected: `startTimer` 의 `notify('scheduleStart', …)` 와 `startNextSession` 의 `notify('scheduleStart', …)` 2건이 남아 있어야 한다. `import { notify }` 는 유지.

- [ ] **Step 4: lint + build**

Run: `npm run lint && npx wxt build`
Expected: 통과. (`noUnusedLocals` 로 미사용 import 가 있으면 여기서 실패 — Step 3에서 확인했으므로 통과해야 함.)

- [ ] **Step 5: 수동 전체 시나리오 검증**

Run: `npm run dev`

1. **최소화 만료**: 뽀모도로 1분 시작 → 최소화 → 만료 시 알림+소리 **1회** 확인. 팝업을 열어도 추가 알림이 오지 않고 `SessionEndPopup` 만 뜨는지 확인.
2. **팝업 열어둔 채 만료**: 뽀모도로 1분 시작 → 팝업(독립 창 모드)을 열어둔 채 대기 → 만료 시 알림+소리 **1회**, `SessionEndPopup` 정상.
3. **일정 노트**: 곧 끝나는 일정 노트 시작 → 최소화 → `scheduleEnd` 알림("일정 시간이 끝났어요.") + `bell` 확인.
4. **만료 전 일시정지**: 뽀모도로 시작 → 30초 후 일시정지 → 원래 만료 시각이 지나도 알림이 오지 않는지 확인.
5. **휴식 종료**: 세션 완료 → 휴식(짧게) → 최소화 → 휴식 종료 알림("휴식이 끝났어요…") + `soft` 확인.
6. **알림 설정 off**: 노트의 완료 알림 토글을 끄고 만료 → OS 알림이 오지 않는지 확인.

- [ ] **Step 6: 커밋**

```bash
git add src/store/useAppStore.ts
git commit -m "refactor: 타이머 종료 알림을 백그라운드로 이전하고 store에서 제거"
```

---

## Self-Review (작성자 체크 완료)

**Spec coverage**
- 목표(창 상태 무관 종료 알림) → Task 4 (알람 예약·발화) + Task 3 (알림 발송).
- offscreen 사운드 → Task 2 + Task 3의 `ensureOffscreenDocument`/`notifyPhaseEnd`.
- 이벤트 판별(work/break/schedule) → Task 3 `resolvePhaseEndEvent`, Task 5 수동 시나리오 1·3·5.
- 판별 컨텍스트를 `storage.session` 에 분리 → Task 4 Step 1·2.
- 서비스 워커 재기동 복원 → Task 4 Step 4 (startup `syncAlarm()`).
- 팝업 경로 종료 `notify()` 제거, `scheduleStart` 유지 → Task 5 Step 1·2·3.
- `EVENTS` 테이블 단일 출처 → Task 1.
- 엣지: 만료 전 일시정지 → Task 4 `syncAlarm` clear 분기 + Task 5 수동 4. 팝업 열린 채 만료 → `syncAlarm` 2초 tolerance + Task 5 수동 2.

**Placeholder scan**: 모든 코드 스텝에 실제 코드 포함. "적절한 에러 처리" 류 표현 없음. Task 3 Step 2는 실행 불가 환경에 대한 명시적 대체 경로를 적어둠.

**Type consistency**: `resolvePhaseEndEvent(noteType, phase)` / `notifyPhaseEnd(note, phase)` 시그니처가 Task 3 정의와 Task 4 호출부에서 일치. `TimerAlarmContext { noteId, phase, endsAt }` 가 Task 4 전체에서 동일. `{ type: 'play-sound', sound }` 메시지 형태가 Task 2 수신부와 Task 3 발신부에서 일치. `EVENTS` / `NotifyEventType` 가 Task 1 정의와 Task 3 import 에서 일치.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-30-background-timer-notification.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - Task별로 새 서브에이전트 디스패치, Task 사이 리뷰, 빠른 이터레이션

**2. Inline Execution** - 이 세션에서 executing-plans 로 체크포인트 배치 실행

**Which approach?**
