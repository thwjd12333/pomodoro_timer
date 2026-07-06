import { useState } from 'react'
import type { NoteStatus, PomodoroNote as PomodoroNoteData } from '../types/note'
import type { TimerState } from '../types/timer'
import { useAppStore } from '../store/useAppStore'
import { useTimer } from '../hooks/useTimer'
import { DEFAULT_TAGS, TAG_COLORS } from '../utils/constants'
import { formatDateHeading, formatDuration, formatTime } from '../utils/formatters'
import { getTodayDate } from '../utils/timeUtils'
import NoteBottomSheet from './NoteBottomSheet'

// 독립 창으로 열렸는지 여부 — 창 안에서는 '창으로 열기' 버튼을 숨김
const isWindowMode = new URLSearchParams(window.location.search).get('mode') === 'window'

// 팝업과 달리 포커스를 잃어도 닫히지 않는 독립 창을 띄우고 현재 팝업은 닫음
const openStandaloneWindow = async () => {
  await chrome.windows.create({
    url: chrome.runtime.getURL('/popup.html?mode=window'),
    type: 'popup',
    width: 380,
    height: 620, // 창 타이틀바 높이만큼 여유
    focused: true,
  })
  window.close()
}

const STATUS_DOT: Record<NoteStatus, string> = {
  idle: 'var(--text-secondary)',
  running: '#30d158',
  paused: '#ffd60a',
  done: '#0F6E56',
  failed: '#B74A4A',
  skipped: '#9B6B2E',
}

// 정렬 우선순위: 진행/일시정지 → 대기 → 종료 상태
const STATUS_ORDER: Record<NoteStatus, number> = {
  running: 0,
  paused: 0,
  idle: 1,
  done: 2,
  failed: 2,
  skipped: 2,
}

const DateHeading = ({ date }: { date: string }) => (
  <div className="flex items-center gap-2 mt-1.5 mb-0.5">
    <div className="w-3 h-px bg-[var(--border)] shrink-0" />
    <span className="text-[11px] font-medium text-[var(--text-secondary)] shrink-0">
      {formatDateHeading(date)}
      {date === getTodayDate() && ' · 오늘'}
    </span>
    <div className="flex-1 h-px bg-[var(--border)]" />
  </div>
)

const DeleteConfirmDialog = ({
  title,
  onCancel,
  onConfirm,
}: {
  title: string
  onCancel: () => void
  onConfirm: () => void
}) => (
  <div className="fixed inset-0 z-30 flex items-center justify-center px-8">
    <div
      className="absolute inset-0 bg-black/50 animate-[fade-in_0.15s_ease-out]"
      onClick={onCancel}
    />
    <div className="relative z-10 w-full bg-[var(--bg-card)] rounded-[18px] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.28)] animate-[fade-in_0.15s_ease-out]">
      <p className="text-[15px] font-semibold text-[var(--text-primary)]">일정을 삭제할까요?</p>
      <p className="text-[13px] text-[var(--text-secondary)] mt-1.5 break-all">
        &lsquo;{title}&rsquo; 일정이 완전히 삭제돼요.
      </p>
      <div className="flex gap-2 mt-5">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-[12px] text-[13px] font-semibold cursor-pointer bg-transparent text-[var(--text-primary)] border border-solid border-[var(--border)] hover:bg-[var(--bg-card-hover)] active:scale-[0.98] transition-all duration-150"
        >
          취소
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-2.5 rounded-[12px] text-[13px] font-semibold cursor-pointer border-0 text-white bg-[#B74A4A] hover:bg-[#a54242] active:scale-[0.98] transition-all duration-150"
        >
          삭제
        </button>
      </div>
    </div>
  </div>
)

const ActionButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="px-4 py-2 rounded-[12px] text-[13px] font-semibold cursor-pointer bg-transparent text-[var(--text-primary)] border border-solid border-[var(--border)] hover:bg-[var(--bg-card-hover)] active:scale-[0.97] transition-all duration-150"
  >
    {label}
  </button>
)

const NoteCard = ({
  note,
  timer,
  onDeleteRequest,
}: {
  note: PomodoroNoteData
  timer: TimerState
  onDeleteRequest: () => void
}) => {
  const startTimer = useAppStore((s) => s.startTimer)
  const pauseTimer = useAppStore((s) => s.pauseTimer)
  const resumeTimer = useAppStore((s) => s.resumeTimer)
  const completeNote = useAppStore((s) => s.completeNote)

  const tag = DEFAULT_TAGS.find((t) => t.id === note.tagId)
  const isActive = timer.noteId === note.id
  const isFinished = note.status === 'done' || note.status === 'failed' || note.status === 'skipped'
  const remaining = isActive ? timer.remaining : note.workDuration * 60
  const progress = isActive && timer.total > 0 ? remaining / timer.total : 1

  // 진행 중 카드는 상태 초록색이 왼쪽 바에 우선, 그 외에는 태그 색상
  const edgeColor =
    note.status === 'running' ? STATUS_DOT.running : tag ? TAG_COLORS[tag.color] : undefined

  const chip =
    isActive && timer.phase === 'break'
      ? { label: '휴식', color: '#1D9E75' }
      : { label: `집중 ${note.sessionCount + 1}`, color: 'var(--color-accent)' }

  return (
    <div
      className="bg-[var(--bg-card)] rounded-[16px] px-4 pt-3.5 pb-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
      style={{
        borderLeft: edgeColor ? `3px solid ${edgeColor}` : undefined,
        opacity: isFinished ? 0.5 : 1,
      }}
    >
      {/* 헤더: 타입 라벨 + 상태 표시 + 삭제 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-[var(--text-secondary)] underline underline-offset-4">
          뽀모도로
        </span>
        <div className="flex items-center gap-2">
          {note.status === 'done' ? (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              className="text-[var(--text-secondary)]"
            >
              <path
                d="M4 12.5 9.5 18 20 6.5"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: STATUS_DOT[note.status] }}
            />
          )}
          <button
            onClick={onDeleteRequest}
            className="w-6 h-6 rounded-full flex items-center justify-center border-0 outline-none cursor-pointer bg-transparent text-[var(--text-secondary)] hover:text-[#B74A4A] hover:bg-[var(--bg-card-hover)] active:scale-90 transition-all duration-150"
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
        </div>
      </div>

      {/* 제목 */}
      <p className="text-[15px] font-semibold text-[var(--text-primary)]">{note.title}</p>

      {/* 종료된 노트는 타이머 대신 시간 설정 요약 표시 */}
      {isFinished && (
        <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
          집중 {formatDuration(note.workDuration)} · 휴식 {formatDuration(note.breakDuration)}
        </p>
      )}

      {/* 타이머 + 프로그레스바 (종료된 노트는 숨김) */}
      {!isFinished && (
        <>
          <p className="text-[32px] font-bold tracking-[-0.5px] text-[var(--text-primary)] mt-1 mb-2 tabular-nums">
            {formatTime(remaining)}
          </p>
          <div className="h-[5px] rounded-full bg-[var(--border)] overflow-hidden mb-3">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </>
      )}

      {/* 하단: 세션 칩 + 액션 버튼 */}
      <div className={`flex items-center justify-between ${isFinished ? 'mt-2' : ''}`}>
        <span
          className="px-2 py-1 rounded-[8px] text-[12px] font-semibold"
          style={{
            backgroundColor: `color-mix(in srgb, ${chip.color} 14%, transparent)`,
            color: chip.color,
          }}
        >
          {isFinished ? `집중 ${note.sessionCount}회 완료` : chip.label}
        </span>
        {!isFinished && (
          <div className="flex gap-2">
            {note.status === 'idle' && (
              <ActionButton label="시작" onClick={() => startTimer(note.id)} />
            )}
            {note.status === 'running' && <ActionButton label="일시정지" onClick={pauseTimer} />}
            {note.status === 'paused' && <ActionButton label="재개" onClick={resumeTimer} />}
            {(note.status === 'running' || note.status === 'paused') && (
              <ActionButton label="완료" onClick={() => completeNote(note.id)} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const PomodoroNote = () => {
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PomodoroNoteData | null>(null)
  const notes = useAppStore((s) => s.notes)
  const deleteNote = useAppStore((s) => s.deleteNote)
  const timer = useTimer()

  const pomodoroNotes = notes
    .filter((n): n is PomodoroNoteData => n.type === 'pomodoro')
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.createdAt - b.createdAt)

  // 생성 날짜별 그룹 — 최신 날짜가 위, 그룹 내부는 상태 정렬 유지
  const notesByDate = new Map<string, PomodoroNoteData[]>()
  for (const note of pomodoroNotes) {
    const group = notesByDate.get(note.date)
    if (group) group.push(note)
    else notesByDate.set(note.date, [note])
  }
  const dates = [...notesByDate.keys()].sort((a, b) => b.localeCompare(a))

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 shrink-0">
        <h1 className="text-[20px] font-bold tracking-[-0.4px] text-[var(--text-primary)]">
          일정관리
        </h1>
        <div className="flex items-center gap-1.5">
          {!isWindowMode && (
            <button
              onClick={openStandaloneWindow}
              className="w-7 h-7 rounded-full flex items-center justify-center border-0 outline-none cursor-pointer transition-all duration-150 bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] active:scale-95"
              aria-label="창으로 열기"
              title="창으로 열기 — 다른 곳을 클릭해도 닫히지 않아요"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path
                  d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <button
            onClick={() => setIsSheetOpen(true)}
            className="w-7 h-7 rounded-full flex items-center justify-center border-0 outline-none cursor-pointer transition-all duration-150 bg-[var(--bg-button)] text-white hover:bg-[var(--bg-button-hover)] active:bg-[var(--bg-button-active)] active:scale-95"
            aria-label="일정 추가"
          >
            <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
              <path
                d="M5 1v8M1 5h8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>
      <div className="h-px bg-[var(--border)] shrink-0" />
      <div className="scroll-area flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
        {dates.map((date) => (
          <div key={date} className="flex flex-col gap-2.5">
            <DateHeading date={date} />
            {notesByDate.get(date)?.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                timer={timer}
                onDeleteRequest={() => setDeleteTarget(note)}
              />
            ))}
          </div>
        ))}
      </div>

      <NoteBottomSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} />
      {deleteTarget && (
        <DeleteConfirmDialog
          title={deleteTarget.title}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            deleteNote(deleteTarget.id)
            setDeleteTarget(null)
          }}
        />
      )}
    </div>
  )
}

export default PomodoroNote
