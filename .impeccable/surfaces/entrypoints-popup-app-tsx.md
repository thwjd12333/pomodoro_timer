---
version: 1
slug: "entrypoints-popup-app-tsx"
primary_target: "entrypoints/popup/App.tsx"
related_targets: ["src/components/PomodoroNote.tsx","src/components/NoteCardParts.tsx","src/components/ScheduleNote.tsx","src/components/SessionEndPopup.tsx","src/components/NoteBottomSheet.tsx","src/styles/global.css"]
---

# PomodoroTimer 팝업 — Direction Contract

Scope: Chrome 확장 팝업/독립창 전체 화면 (entrypoints/popup, src/components). Mode: Operate.
Audience/Job/Task: 브라우저 작업 중 짧게 팝업을 열어 "지금 뭘 해야 하는지 / 다음이 뭔지"를 즉시 확인하고, 세션 완료·연장·넘기기 결정을 내림.
Proof/content: 실제 노트 데이터(뽀모도로/일정), 진행률, 태그, 상태(대기/진행/일시정지/완료/미완료/넘김).
Constraints: 기능·로직·스토어·타입 변경 금지(시각만 교체), 라이트/다크 둘 다 유지, 팝업 크기 380×580 고정, 애니메이션은 절제(과시적 모션 금지), Tailwind v4 유지.

## Direction contract

THESIS: 진행 중인 노트 하나를 유리질 히어로 위젯이 먼저 말하게 하고 나머지는 압축된 카드로 훑게 한다 — 모든 카드가 똑같은 크기로 동시에 소리치는 지금의 평면 나열을 거부한다.

OWN-WORLD: 무광 그래파이트/화이트 바탕 + 코발트 액센트(#3A5FE0 계열) 하나, frosted-glass 블러를 쓰는 둥근 스퀴클(20px+) 카드, 시스템 폰트(-apple-system 계열, San Francisco 성격 유지), 상태는 항상 색+텍스트 라벨을 함께 표기, 액션 버튼은 색뿐 아니라 필/아웃라인/아이콘 형태로도 구분.

STORY: 팝업을 열면 진행 중(또는 다음) 노트를 1초 안에 인지 → 아래로 훑으며 나머지 노트를 스캔 → 상태 변화가 필요하면 형태로 구분된 버튼으로 완료/연장/넘기기 결정.

FIRST VIEWPORT: 헤더(PomodoroTimer 워드마크 + 아이콘 2개) 아래, 폭 전체를 쓰는 유리질 히어로 위젯 1장(원형 다이얼 타이머 + 노트 제목·상태) — 다이얼 링의 밝기·채도가 남은 시간에 따라 연속적으로 변함. 그 아래 날짜 구분선과 압축된 유리 카드 리스트가 이어짐.

FORM: 글래스 컨트롤센터 — direction seed key 33f08acb (scope: direction, mode: operate), assigned index 6. 챌린저 '라이브 게이트 보드'(탑승권+실시간 전광판)에게 제품 명료성에서 근접 패배했으나, 그 규율(연속적 색 변화, 색+텍스트 동시 표기, 형태로 액션 구분, 단계당 단일 지배색)을 이식받아 보강됨.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
