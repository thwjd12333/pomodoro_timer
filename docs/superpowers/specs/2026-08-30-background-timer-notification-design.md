# 백그라운드 타이머 알림 설계

## 배경 / 문제

타이머 완료 감지와 알림 발송이 전부 팝업(페이지) 컨텍스트에서 일어난다.

- `src/hooks/useTimer.ts` — `setInterval(1000)`으로 매초 리렌더하며 `remaining <= 0`이면 `advancePhase()` 호출
- `src/store/useAppStore.ts`의 `advancePhase()` 안에서 `notify()`로 OS 알림 + 사운드 발송

Chrome은 최소화되거나 가려진 창의 JS 타이머를 강하게 지연/정지시킨다. 그래서 크롬 창을 내려두면:

1. `setInterval`이 멈춰 `remaining`이 0으로 갱신되지 않고 `advancePhase()`가 호출되지 않음 → 알림 없음
2. 창을 다시 활성화하면 인터벌이 재개되며 그제서야 `advancePhase()`가 실행됨 → 뒤늦은 알림

`entrypoints/background.ts`는 의도적으로 뱃지만 관리하고, 단계 전환과 알림은 "다음 팝업 오픈 때"로 미루고 있다. 즉 백그라운드에는 알림을 발송하는 주체가 없다.

## 목표

크롬 창 상태(최소화 / 포커스 해제 / 팝업 닫힘)와 무관하게, 타이머가 끝나는 시점에 OS 알림과 사운드가 발송된다.

## 비목표

- 알림에 액션 버튼을 달지 않는다. 알림 클릭 시 팝업이 열리는 기존 동작만 유지한다.
- 백그라운드가 상태 전환(`pendingDecision` 세팅, 세션 카운트 증가 등)을 직접 수행하지 않는다. 상태 전환은 기존대로 팝업이 열릴 때 `advancePhase()`가 처리한다.
- `scheduleStart`(타이머 시작 시점 알림)는 변경하지 않는다. 사용자가 직접 시작을 눌러 팝업이 확실히 열려 있는 순간이므로 팝업 컨텍스트 발송을 유지한다.

## 접근

종료 알림의 소유권을 팝업에서 백그라운드 서비스 워커로 완전히 이전한다. 팝업 경로의 종료 `notify()` 호출을 제거하므로 이중 알림 문제가 원천적으로 사라지고, 디둡 마커가 필요 없다.

트레이드오프: 팝업이 열려 있을 때도 완료 알림이 store 즉시 발송 대신 `chrome.alarms` 발화를 경유한다. `when` 기반 one-shot 알람은 보통 1초 안에 발화하므로 체감 지연은 없다.

## 데이터 흐름

```
타이머 시작/재개
  → store가 timerState.endsAt 기록 (chrome.storage.sync)
  → storage.onChanged
  → background.syncAlarm()
      - timerState.isRunning && endsAt 있음 && endsAt 이 아직 미래:
          chrome.alarms.create('timer-end', { when: endsAt })
          chrome.storage.session 에 판별 컨텍스트 { noteId, phase, endsAt } 기록
          (이미 만료된 endsAt 으로는 재예약하지 않음 — 처리된 만료가 이후 저장 변경으로
           다시 알림을 쏘는 것을 방지)
      - 그 외인데 컨텍스트의 endsAt 이 이미 경과(또는 2초 이내로 임박):
          아무것도 하지 않음 — 팝업이 먼저 단계를 전환한 경우이므로 만료 전에 예약된
          알람이 한 번 발화하도록 남겨둔다 (handleTimerEnd 가 발화 후 컨텍스트를 제거)
      - 그 외(만료 전 일시정지/전환/삭제/idle):
          chrome.alarms.clear('timer-end')
          chrome.storage.session 컨텍스트 제거

endsAt 도달
  → chrome.alarms.onAlarm ('timer-end')
  → background: storage.session 컨텍스트 + storage.sync 상태를 읽음
  → 컨텍스트가 유효하고 endsAt <= now 이면 이벤트 판별:
      note.type === 'schedule'      → 'scheduleEnd'
      phase === 'work'              → 'sessionComplete'
      phase === 'break'             → 'breakEnd'
  → 노트별 알림 설정에 따라:
      OS 알림 발송 (chrome.notifications)
      offscreen 문서에 사운드 재생 요청
  → storage.session 컨텍스트 제거

알림 클릭
  → (기존) chrome.notifications.onClicked → 팝업/독립 창 오픈
  → 팝업의 useTimer가 만료 상태 감지 → advancePhase() → pendingDecision 세팅 → SessionEndPopup 표시
```

판별 컨텍스트를 `storage.session`에 따로 두는 이유: `chrome.alarms`는 페이로드를 실을 수 없고, 알람 발화 시점에는 팝업이 먼저 `advancePhase()`를 실행해 `timerState`를 비웠을 수 있다. 예약 시점의 `phase`를 별도 기록해야 이벤트 판별이 레이스와 무관하게 안정적이다.

서비스 워커 재기동 시 `syncAlarm()`이 `storage.sync`의 `timerState`를 다시 읽어 알람과 컨텍스트를 복원한다(기존 `refreshBadge()` 호출 지점과 동일하게 startup에서 실행). 단, `chrome.alarms`는 서비스 워커 재기동을 넘어 유지되므로 대부분의 경우 알람은 이미 살아 있다. 브라우저 재시작으로 알람이 유실되고 그 사이 `endsAt`이 지나버린 경우에는 재알림하지 않는다(기존 동작과 동일 — 팝업을 열 때 처리).

## 컴포넌트

### `entrypoints/background.ts` (변경)

- `syncAlarm()` 추가: `storage.onChanged`(sync 영역, STORAGE_KEY 변경) 및 startup에서 호출. 위 데이터 흐름대로 `timer-end` 알람과 `storage.session` 컨텍스트를 켜고 끈다.
- `chrome.alarms.onAlarm` 리스너에 `timer-end` 분기 추가. 기존 `badge-refresh` 분기는 그대로.
- 이벤트 판별 + 알림 발송은 `phaseNotifier`에 위임.

### `src/background/phaseNotifier.ts` (신규)

`src/background/badgeManager.ts`와 동일한 "백그라운드 전용 단일 책임 모듈" 패턴.

- `resolvePhaseEndEvent(noteType, phase): NotifyEventType` — 순수 함수. `(noteType, phase)` → `'scheduleEnd' | 'sessionComplete' | 'breakEnd'` 매핑.
- `notifyPhaseEnd(note, phase): Promise<void>` — 이벤트를 판별하고, 노트의 알림/사운드 설정(`notifyOnComplete`/`soundOnComplete`, `notifyOnEnd`/`soundOnEnd`)에 따라 OS 알림 발송 + offscreen 사운드 요청. 메시지·사운드 매핑은 `src/utils/notifyEvents.ts`의 `EVENTS` 테이블을 팝업 `notifier`와 공유한다.
- `ensureOffscreenDocument()` — `chrome.offscreen.hasDocument()` 가드 후 `chrome.offscreen.createDocument({ url, reasons: ['AUDIO_PLAYBACK'], justification })`.

### `entrypoints/offscreen/` (신규)

WXT의 unlisted-page 엔트리포인트(`entrypoints/offscreen/index.html` + `main.ts`)로 빌드하면 출력물에 `offscreen.html`이 생성되고 `chrome.runtime.getURL('offscreen.html')`로 로드한다.

- `main.ts` — `chrome.runtime.onMessage`로 `{ type: 'play-sound', sound: SoundType }` 수신 → 기존 `src/utils/soundUtils.ts`의 `playSound(sound)` 호출. 재사용이므로 사운드 생성 로직 신규 작성 없음.

### `src/store/useAppStore.ts` (변경)

- `advancePhase()` 안의 종료 `notify()` 호출 2곳 제거:
  - schedule 분기의 `notify('scheduleEnd', ...)`
  - pomodoro 분기의 `notify(kind === 'sessionEnd' ? 'sessionComplete' : 'breakEnd', ...)`
- `startTimer()` / `startNextSession()`의 `notify('scheduleStart', ...)`는 유지.
- 다른 상태 전환 로직은 일절 건드리지 않는다.

### `src/utils/notifier.ts` (변경 없음 또는 최소)

`scheduleStart` 발송에 계속 쓰인다. `EVENTS` 테이블을 `phaseNotifier`와 공유하기 위해 테이블만 별도 모듈로 추출할 수 있다(선택).

### `wxt.config.ts` / manifest

`offscreen` 권한은 이미 존재. 추가 권한 불필요. WXT가 unlisted-page를 web_accessible_resources로 자동 처리하는지 플랜 단계에서 확인하고, 필요 시 `web_accessible_resources`에 `offscreen.html` 추가.

## 엣지 케이스

- **팝업이 열려 있는 상태에서 만료**: `useTimer`가 `advancePhase()`로 상태를 전환하면 `isRunning`이 `false`가 되지만, `syncAlarm()`은 컨텍스트의 `endsAt`이 경과했음을 보고 알람을 지우지 않고 남겨둔다. 알람이 곧(보통 1초 내) 발화해 백그라운드가 알림을 1회 발송한다. 팝업 경로는 종료 `notify()`를 제거했으므로 중복 없음.
- **만료 직후 서비스 워커 재기동**: `chrome.alarms`는 워커 재기동을 넘어 유지되며, 지난 `when`은 즉시 발화한다. 컨텍스트가 `storage.session`에서 사라졌다면 startup의 `syncAlarm()`이 `storage.sync` 상태로 재구성한다.
- **사용자가 만료 전 일시정지**: `endsAt`이 `null`이 되어 `syncAlarm()`이 알람을 제거. 알림 없음.
- **다른 노트로 타이머 전환**: `startTimer()`가 새 `endsAt`을 쓰므로 `syncAlarm()`이 알람을 새 시각으로 재예약.
- **알림 클릭으로 팝업이 열려 뒤늦게 `advancePhase()` 실행**: 종료 `notify()`를 제거했으므로 추가 알림이 발생하지 않는다.
- **브라우저 재시작으로 알람 유실 가능성**: startup `syncAlarm()`이 재예약. 재시작에 걸린 시간 동안의 만료는 팝업을 열 때 기존 로직으로 처리된다(현 동작 대비 후퇴 없음).

## 테스트 / 검증

이 프로젝트에는 테스트 러너가 없다. 신규 도입은 이번 작업 범위 밖.

- `resolvePhaseEndEvent`는 순수 함수로 작성해 자명하게 검토 가능하게 한다.
- `npm run lint` 및 `wxt build` 통과.
- 수동 검증:
  1. 뽀모도로 타이머를 짧게(예: 1분) 시작 → 크롬 창 최소화 → 만료 시점에 OS 알림 + 소리 발생 확인.
  2. 팝업을 다시 열었을 때 알림이 중복 발생하지 않고 `SessionEndPopup`이 뜨는지 확인.
  3. 일정(schedule) 노트로 동일 시나리오 → `scheduleEnd` 알림 확인.
  4. 만료 전 일시정지 → 알림이 오지 않는지 확인.
  5. 팝업을 연 채로 만료 → 알림 1회만, 상태 전환 정상 확인.
```
