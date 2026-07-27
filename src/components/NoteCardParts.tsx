import type { ReactNode } from 'react'
import type { Note, NoteStatus, NoteType } from '../types/note'
import { STATUS_DOT, TYPE_META } from '../utils/constants'
import { formatDuration } from '../utils/formatters'
import { minutesBetween } from '../utils/timeUtils'

// 노트 카드 공용 부품 — 뽀모도로/일정 카드와 종료 노트 행이 함께 사용

const STATUS_LABEL: Record<NoteStatus, string> = {
  idle: '대기',
  running: '진행 중',
  paused: '일시정지',
  done: '완료',
  failed: '미완료',
  skipped: '넘김',
}

export const TypeBadge = ({ type }: { type: NoteType }) => {
  const { label, color } = TYPE_META[type]
  return (
    <span
      className="px-2 py-[3px] rounded-full text-[11px] font-semibold shrink-0"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
        color,
      }}
    >
      {label}
    </span>
  )
}

export const DeleteButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-0 outline-none cursor-pointer bg-transparent text-[var(--text-secondary)] hover:text-[#B74A4A] hover:bg-[var(--bg-card-hover)] active:scale-90 transition-all duration-150"
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
      className="w-5 h-4 flex items-center justify-center border-0 outline-none cursor-pointer bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 transition-all duration-150"
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
      className="w-5 h-4 flex items-center justify-center border-0 outline-none cursor-pointer bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 transition-all duration-150"
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

// primary(완료 등 확정 동작)는 초록 채움, 기본은 외곽선 스타일
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
    className={`px-3 py-2 rounded-[12px] text-[13px] font-semibold cursor-pointer active:scale-[0.97] transition-all duration-150 ${
      primary
        ? 'border-0 text-white bg-[#0F6E56] hover:bg-[#0c5c48]'
        : 'bg-transparent text-[var(--text-primary)] border border-solid border-[var(--border)] hover:bg-[var(--bg-card-hover)]'
    }`}
  >
    {label}
  </button>
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

// 완료 ✓ / 미완료 − / 넘김 + 를 틴트 원 안에 표시
const FinishedStatusIcon = ({ status }: { status: NoteStatus }) => {
  const color = STATUS_DOT[status]
  return (
    <span
      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold leading-none"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 22%, transparent)`,
        color,
      }}
    >
      {status === 'done' ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 12.5 9.5 18 20 6.5"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : status === 'failed' ? (
        '−'
      ) : (
        '+'
      )}
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
  <div className="bg-[var(--bg-card)] rounded-[14px] pl-3 pr-1.5 py-2 opacity-50">
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

// 진행/대기 노트 카드 공통 레이아웃 — 내용만 타입별 컴포넌트에서 주입
export const NoteCardFrame = ({
  type,
  status,
  title,
  subtitle,
  display,
  displayMuted = false,
  progress,
  infoLeft,
  actions,
  tagColor,
  ringColor,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDeleteRequest,
}: {
  type: NoteType
  status: NoteStatus
  title: string
  subtitle: string
  display: string
  displayMuted?: boolean
  progress: number // 0~1
  infoLeft: string
  actions: ReactNode
  tagColor?: string
  ringColor?: string // 진행 중 테두리 색 (미지정 시 타입 색상)
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDeleteRequest: () => void
}) => {
  const accent = TYPE_META[type].color
  const baseShadow = '0 1px 3px rgba(0,0,0,0.08)'
  // 진행 중엔 단계 색(미지정 시 타입 색), 일시정지 중엔 상태 점과 같은 노란색 링으로 강조
  const ring =
    status === 'running'
      ? (ringColor ?? accent)
      : status === 'paused'
        ? STATUS_DOT.paused
        : null

  return (
    <div
      className="bg-[var(--bg-card)] rounded-[16px] px-4 pt-3.5 pb-4"
      style={{
        borderLeft: tagColor ? `3px solid ${tagColor}` : undefined,
        boxShadow: ring
          ? `inset 0 0 0 1.5px ${ring}, ${baseShadow}`
          : baseShadow,
      }}
    >
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

      <p
        className="text-[24px] font-bold tracking-[-0.5px] mt-1 mb-2 tabular-nums"
        style={{
          color: displayMuted ? 'var(--text-secondary)' : 'var(--text-primary)',
        }}
      >
        {display}
      </p>

      <div className="h-[5px] rounded-full bg-[var(--border)] overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${progress * 100}%`, backgroundColor: accent }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--text-secondary)] min-w-0">
          {infoLeft}
        </span>
        <div className="flex gap-1.5 shrink-0">{actions}</div>
      </div>
    </div>
  )
}
