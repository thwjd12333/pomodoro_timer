import type { ReactNode } from 'react'
import type { Note, NoteStatus, NoteType } from '../types/note'
import { STATUS_DOT, STATUS_LABEL, TYPE_META } from '../utils/constants'
import { glassBlur } from '../utils/colorUtils'
import { formatDuration } from '../utils/formatters'
import { minutesBetween } from '../utils/timeUtils'

// 노트 카드 공용 부품 — 뽀모도로/일정 카드와 종료 노트 행이 함께 사용

// 타입/태그/상태를 나타내는 공용 점 — 색은 점에만 쓰고 글자는 항상 중립색 텍스트와 짝을 이룸
// (색만으로 의미를 전달하지 않기 위함)
const Dot = ({ color, size = 7 }: { color: string; size?: number }) => (
  <span
    className="rounded-full shrink-0"
    style={{ width: size, height: size, backgroundColor: color }}
  />
)

export const TypeBadge = ({ type }: { type: NoteType }) => {
  const { label, color } = TYPE_META[type]
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <Dot color={color} />
      <span className="text-[11px] font-medium text-[var(--text-secondary)]">
        {label}
      </span>
    </span>
  )
}

// 상태 점 + 라벨 — 진행 중 카드 헤더와 히어로 위젯이 공유
export const StatusTag = ({ status }: { status: NoteStatus }) => (
  <span className="inline-flex items-center gap-1.5 shrink-0">
    <Dot color={STATUS_DOT[status]} />
    <span className="text-[11px] font-medium text-[var(--text-secondary)]">
      {STATUS_LABEL[status]}
    </span>
  </span>
)

// 태그 색상 표시 — 두꺼운 좌측 보더 대신 작은 점으로만 표시
export const TagDot = ({ color }: { color: string }) => <Dot color={color} />

export const DeleteButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-0 outline-none cursor-pointer bg-transparent text-[var(--text-secondary)] hover:text-[var(--color-urgent)] hover:bg-[var(--bg-card-hover)] active:scale-90 transition-transform duration-150"
    aria-label="노트 삭제"
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m5 5v6m4-6v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
)

// 미완료 노트 카드의 진행 순서 변경 — 그룹 내 첫/마지막 항목은 해당 방향 비활성화
export const OrderButtons = ({
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) => (
  <div className="flex flex-col shrink-0">
    <button
      onClick={onMoveUp}
      disabled={isFirst}
      aria-label="순서 위로"
      className="w-5 h-4 flex items-center justify-center border-0 outline-none cursor-pointer bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 transition-transform duration-150"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <path
          d="M18 15l-6-6-6 6"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
    <button
      onClick={onMoveDown}
      disabled={isLast}
      aria-label="순서 아래로"
      className="w-5 h-4 flex items-center justify-center border-0 outline-none cursor-pointer bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 transition-transform duration-150"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <path
          d="M6 9l6 6 6-6"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  </div>
)

const ACTION_ICON: Record<string, ReactNode> = {
  시작: <path d="M6 4l14 8-14 8V4z" fill="currentColor" />,
  '지금 시작': <path d="M6 4l14 8-14 8V4z" fill="currentColor" />,
  재개: <path d="M6 4l14 8-14 8V4z" fill="currentColor" />,
  일시정지: <path d="M7 4h3v16H7zM14 4h3v16h-3z" fill="currentColor" />,
  완료: (
    <path
      d="M4 12.5 9.5 18 20 6.5"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  그만하기: (
    <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" />
  ),
}

// primary(확정 동작)는 채움 + 체크 아이콘, 기본은 아웃라인 + 재생형 아이콘 —
// 색뿐 아니라 형태로도 주/보조 액션을 구분함
export const ActionButton = ({
  label,
  onClick,
  primary = false,
}: {
  label: string
  onClick: () => void
  primary?: boolean
}) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold cursor-pointer active:scale-[0.97] transition-transform duration-150 ${
      primary
        ? 'border-0 text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]'
        : 'bg-transparent text-[var(--text-primary)] border border-solid border-[var(--border)] hover:bg-[var(--bg-card-hover)]'
    }`}
  >
    <svg width="11" height="11" viewBox="0 0 24 24">
      {ACTION_ICON[label]}
    </svg>
    {label}
  </button>
)

// 원형 다이얼 — 히어로 위젯의 진행률 표시. 중앙에 임의 콘텐츠(타이머 숫자)를 얹음
export const RingDial = ({
  progress,
  color,
  size = 84,
  strokeWidth = 6,
  children,
}: {
  progress: number
  color: string
  size?: number
  strokeWidth?: number
  children?: ReactNode
}) => {
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - Math.max(0, Math.min(1, progress)))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.6s ease, stroke 0.6s ease',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}

// 진행 중(또는 일시정지 중인) 단 하나의 노트를 위한 히어로 위젯 —
// 큰 유리 위젯 하나가 "지금 뭘 하고 있는지"를 먼저 말하고, 나머지는 압축 카드로 훑게 함
export const NoteHero = ({
  type,
  status,
  title,
  subtitle,
  display,
  progress,
  ringColor,
  phaseLabel,
  phaseColor,
  tagColor,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDeleteRequest,
  actions,
}: {
  type: NoteType
  status: NoteStatus
  title: string
  subtitle: string
  display: string
  progress: number
  ringColor: string
  phaseLabel: string
  phaseColor?: string
  actions: ReactNode
  tagColor?: string
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDeleteRequest: () => void
}) => (
  <div
    className="glass-surface rounded-[var(--radius-hero)] border border-[var(--border)] px-5 pt-4 pb-[18px]"
    style={{ ...glassBlur, boxShadow: 'var(--shadow-hero)' }}
  >
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2.5">
        <TypeBadge type={type} />
        {tagColor && <TagDot color={tagColor} />}
      </div>
      <div className="flex items-center gap-1">
        <OrderButtons
          isFirst={isFirst}
          isLast={isLast}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
        <DeleteButton onClick={onDeleteRequest} />
      </div>
    </div>

    <div className="flex items-center gap-4">
      <RingDial progress={progress} color={ringColor} size={80} strokeWidth={6}>
        <span className="text-[16px] font-bold tabular-nums tracking-[-0.3px] text-[var(--text-primary)]">
          {display}
        </span>
      </RingDial>
      <div className="min-w-0 flex-1">
        <span className="inline-flex items-center gap-1.5 mb-1">
          <Dot color={phaseColor ?? STATUS_DOT[status]} />
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            {phaseLabel}
          </span>
        </span>
        <p className="text-[16px] font-semibold text-[var(--text-primary)] truncate">
          {title}
        </p>
        <p className="text-[12px] text-[var(--text-secondary)] mt-0.5 truncate">
          {subtitle}
        </p>
      </div>
    </div>

    <div className="flex items-center justify-end gap-2 mt-4">{actions}</div>
  </div>
)

// 종료 노트 정보 줄 — 뽀모도로: 상태·집중/휴식/연장 시간, 일정: 시간 범위·길이
const finishedSummary = (note: Note): string => {
  if (note.type === 'schedule')
    return `${note.startTime} — ${note.endTime} · ${formatDuration(minutesBetween(note.startTime, note.endTime))}`

  const times = `집중 ${formatDuration(note.workDuration)} · 휴식 ${formatDuration(note.breakDuration)}`
  const extendedTag =
    note.extendedMinutes > 0
      ? ` · +${formatDuration(note.extendedMinutes)} 연장`
      : ''
  return `${STATUS_LABEL[note.status]} · ${times}${extendedTag}`
}

// 완료 ✓ / 미완료 − / 넘김 + 를 채움 원 안에 표시 — 흰 글리프로 고정해 어떤 상태색에서도 대비를 보장함
const FinishedStatusIcon = ({ status }: { status: NoteStatus }) => {
  const color = STATUS_DOT[status]
  return (
    <span
      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white"
      style={{ backgroundColor: color }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        {status === 'done' ? (
          <path
            d="M4 12.5 9.5 18 20 6.5"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : status === 'failed' ? (
          <path
            d="M6 12h12"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M7 4l8 8-8 8"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </span>
  )
}

// 종료(done/failed/skipped) 노트의 요약 행 — 제목 줄 + 시간 정보 줄
export const FinishedNoteRow = ({
  note,
  onDeleteRequest,
}: {
  note: Note
  onDeleteRequest: () => void
}) => (
  <div
    className="glass-surface rounded-[var(--radius-card)] border border-[var(--border)] pl-3 pr-1.5 py-2 opacity-60"
    style={glassBlur}
  >
    <div className="flex items-center gap-2">
      <FinishedStatusIcon status={note.status} />
      <TypeBadge type={note.type} />
      <p className="flex-1 min-w-0 truncate text-[13px] font-medium text-[var(--text-primary)]">
        {note.title}
      </p>
      <DeleteButton onClick={onDeleteRequest} />
    </div>
    {/* pl-7 = 상태 아이콘(20px) + 간격(8px) — 뱃지 시작 위치에 맞춰 정렬 */}
    <p className="text-[11px] text-[var(--text-secondary)] mt-1 pl-7">
      {finishedSummary(note)}
    </p>
  </div>
)

// 진행/대기 노트의 압축 카드 — 리스트의 기본 단위. 실행 중인 타이머가 없으면
// 숫자·진행바를 그리지 않아 대기 노트를 가볍게 유지함
export const NoteCardFrame = ({
  type,
  status,
  title,
  subtitle,
  display,
  showTimer = true,
  progress,
  tagColor,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDeleteRequest,
  actions,
}: {
  type: NoteType
  status: NoteStatus
  title: string
  subtitle: string
  display: string
  showTimer?: boolean
  progress: number // 0~1
  actions: ReactNode
  tagColor?: string
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDeleteRequest: () => void
}) => {
  const accent = TYPE_META[type].color
  const isPausedElsewhere = status === 'paused'

  return (
    <div
      className="glass-surface rounded-[var(--radius-card)] border px-4 pt-3.5 pb-4"
      style={{
        ...glassBlur,
        borderColor: isPausedElsewhere ? STATUS_DOT.paused : 'var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <TypeBadge type={type} />
          {tagColor && <TagDot color={tagColor} />}
          <StatusTag status={status} />
        </div>
        <div className="flex items-center gap-1">
          <OrderButtons
            isFirst={isFirst}
            isLast={isLast}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
          />
          <DeleteButton onClick={onDeleteRequest} />
        </div>
      </div>

      <p className="text-[15px] font-semibold text-[var(--text-primary)]">
        {title}
      </p>
      <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
        {subtitle}
      </p>

      {showTimer && (
        <>
          <p className="text-[22px] font-bold tracking-[-0.4px] mt-1 mb-2 tabular-nums text-[var(--text-primary)]">
            {display}
          </p>
          <div className="h-[5px] rounded-full bg-[var(--border)] overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${progress * 100}%`, backgroundColor: accent }}
            />
          </div>
        </>
      )}

      <div className="flex items-center justify-end gap-1.5 mt-2.5">
        {actions}
      </div>
    </div>
  )
}
