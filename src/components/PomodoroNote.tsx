import { useState } from 'react'
import type {
  Note,
  NoteStatus,
  PomodoroNote as PomodoroNoteData,
} from '../types/note'
import type { TimerState } from '../types/timer'
import { useAppStore } from '../store/useAppStore'
import { useTimer } from '../hooks/useTimer'
import { DEFAULT_TAGS, TAG_COLORS } from '../utils/constants'
import { glassBlur, ringColorFor } from '../utils/colorUtils'
import {
  formatDateHeading,
  formatDuration,
  formatTime,
} from '../utils/formatters'
import { getTodayDate } from '../utils/timeUtils'
import NoteBottomSheet from './NoteBottomSheet'
import ScheduleNoteCard from './ScheduleNote'
import SessionEndPopup from './SessionEndPopup'
import {
  ActionButton,
  FinishedNoteRow,
  NoteCardFrame,
  NoteHero,
} from './NoteCardParts'

// 독립 창으로 열렸는지 여부 — 창 안에서는 '창으로 열기' 버튼을 숨김
const isWindowMode =
  new URLSearchParams(window.location.search).get('mode') === 'window'

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

const isFinished = (note: Note): boolean =>
  note.status === 'done' ||
  note.status === 'failed' ||
  note.status === 'skipped'

// 정렬 우선순위: 미완료(0) → 완료(1). 동률 시 미완료는 order 오름차순, 완료는 최신순
const STATUS_ORDER: Record<NoteStatus, number> = {
  idle: 0,
  running: 0,
  paused: 0,
  done: 1,
  failed: 1,
  skipped: 1,
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
      className="absolute inset-0 bg-[var(--scrim)] animate-[fade-in_0.15s_ease-out]"
      onClick={onCancel}
    />
    <div
      className="glass-surface relative z-10 w-full rounded-[var(--radius-card)] border border-[var(--border)] p-5 animate-[fade-in_0.15s_ease-out]"
      style={{ ...glassBlur, boxShadow: 'var(--shadow-pop)' }}
    >
      <p className="text-[15px] font-semibold text-[var(--text-primary)]">
        일정을 삭제할까요?
      </p>
      <p className="text-[13px] text-[var(--text-secondary)] mt-1.5 break-all">
        &lsquo;{title}&rsquo; 일정이 완전히 삭제돼요.
      </p>
      <div className="flex gap-2 mt-5">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-full text-[13px] font-semibold cursor-pointer bg-transparent text-[var(--text-primary)] border border-solid border-[var(--border)] hover:bg-[var(--bg-card-hover)] active:scale-[0.98] transition-transform duration-150"
        >
          취소
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-2.5 rounded-full text-[13px] font-semibold cursor-pointer border-0 text-white bg-[var(--color-urgent)] hover:brightness-95 active:scale-[0.98] transition-transform duration-150"
        >
          삭제
        </button>
      </div>
    </div>
  </div>
)

const PomodoroCard = ({
  note,
  timer,
  isFirst,
  isLast,
  onDeleteRequest,
}: {
  note: PomodoroNoteData
  timer: TimerState
  isFirst: boolean
  isLast: boolean
  onDeleteRequest: () => void
}) => {
  const startTimer = useAppStore(s => s.startTimer)
  const pauseTimer = useAppStore(s => s.pauseTimer)
  const resumeNote = useAppStore(s => s.resumeNote)
  const completeSession = useAppStore(s => s.completeSession)
  const completeNote = useAppStore(s => s.completeNote)
  const moveNoteUp = useAppStore(s => s.moveNoteUp)
  const moveNoteDown = useAppStore(s => s.moveNoteDown)

  const tag = DEFAULT_TAGS.find(t => t.id === note.tagId)
  const isActive = timer.noteId === note.id
  // 다른 노트에 밀려난 경우 스냅샷 시점의 남은 시간·진행도를 그대로 보여줌
  const suspended = isActive ? null : note.suspendedTimer
  const remaining = isActive
    ? timer.remaining
    : suspended
      ? suspended.remaining
      : note.workDuration * 60
  const progress =
    isActive && timer.total > 0
      ? remaining / timer.total
      : suspended && suspended.total > 0
        ? suspended.remaining / suspended.total
        : 1
  const onBreak = (isActive ? timer.phase : suspended?.phase) === 'break'
  const tagColor = tag ? TAG_COLORS[tag.color] : undefined

  const actions = (
    <>
      {note.status === 'idle' && (
        <ActionButton label="시작" onClick={() => startTimer(note.id)} />
      )}
      {note.status === 'running' && (
        <ActionButton label="일시정지" onClick={pauseTimer} />
      )}
      {note.status === 'paused' && (
        <ActionButton label="재개" onClick={() => resumeNote(note.id)} />
      )}
      {/* 밀려나 일시정지된 노트는 [재개]만 — 완료 동작은 재개 후에 */}
      {(note.status === 'running' ||
        (note.status === 'paused' && isActive)) && (
        // 집중 중 완료: 세션 완료로 치고 휴식 시작, 휴식 중 그만하기: 노트 완료 처리
        <ActionButton
          label={onBreak ? '그만하기' : '완료'}
          primary
          onClick={() => (onBreak ? completeNote(note.id) : completeSession())}
        />
      )}
    </>
  )

  // 지금 타이머를 쥐고 있는 노트만 히어로 위젯 — 나머지(대기·밀려난 일시정지)는 압축 카드
  if (isActive)
    return (
      <NoteHero
        type="pomodoro"
        status={note.status}
        title={note.title}
        subtitle={`${formatDuration(note.workDuration)} 집중 · ${formatDuration(note.breakDuration)} 휴식`}
        display={formatTime(remaining)}
        progress={progress}
        ringColor={ringColorFor(progress, timer.phase)}
        phaseLabel={
          note.status === 'paused'
            ? '일시정지'
            : onBreak
              ? '휴식 중'
              : '집중 중'
        }
        phaseColor={onBreak ? 'var(--color-break)' : 'var(--color-accent)'}
        actions={actions}
        tagColor={tagColor}
        isFirst={isFirst}
        isLast={isLast}
        onMoveUp={() => moveNoteUp(note.id)}
        onMoveDown={() => moveNoteDown(note.id)}
        onDeleteRequest={onDeleteRequest}
      />
    )

  return (
    <NoteCardFrame
      type="pomodoro"
      status={note.status}
      title={note.title}
      subtitle={`${formatDuration(note.workDuration)} 집중 · ${formatDuration(note.breakDuration)} 휴식`}
      display={formatTime(remaining)}
      showTimer={!!suspended}
      progress={progress}
      actions={actions}
      tagColor={tagColor}
      isFirst={isFirst}
      isLast={isLast}
      onMoveUp={() => moveNoteUp(note.id)}
      onMoveDown={() => moveNoteDown(note.id)}
      onDeleteRequest={onDeleteRequest}
    />
  )
}

const PomodoroNote = () => {
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)
  const notes = useAppStore(s => s.notes)
  const deleteNote = useAppStore(s => s.deleteNote)
  const timer = useTimer()

  // 미완료 그룹은 order 오름차순, 완료 그룹은 생성 최신순
  const sortedNotes = [...notes].sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (statusDiff !== 0) return statusDiff
    return isFinished(a) ? b.createdAt - a.createdAt : a.order - b.order
  })

  // 날짜별 그룹 — 최신 날짜가 위, 그룹 내부는 상태 정렬 유지
  const notesByDate = new Map<string, Note[]>()
  for (const note of sortedNotes) {
    const group = notesByDate.get(note.date)
    if (group) group.push(note)
    else notesByDate.set(note.date, [note])
  }
  const dates = [...notesByDate.keys()].sort((a, b) => b.localeCompare(a))

  const isEmpty = notes.length === 0

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <header
        className="glass-surface flex items-center justify-between px-4 py-3 shrink-0 border-b border-[var(--border)]"
        style={glassBlur}
      >
        <h1 className="text-[19px] font-bold tracking-[-0.4px] text-[var(--text-primary)]">
          PomodoroTimer
        </h1>
        <div className="flex items-center gap-1.5">
          {!isWindowMode && (
            <button
              onClick={openStandaloneWindow}
              className="w-7 h-7 rounded-full flex items-center justify-center border-0 outline-none cursor-pointer transition-transform duration-150 bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] active:scale-95"
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
            className="w-7 h-7 rounded-full flex items-center justify-center border-0 outline-none cursor-pointer transition-transform duration-150 bg-[var(--bg-button)] text-white hover:bg-[var(--bg-button-hover)] active:bg-[var(--bg-button-active)] active:scale-95"
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
      {isEmpty && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <div
            className="glass-surface w-14 h-14 rounded-full flex items-center justify-center border border-[var(--border)]"
            style={{ ...glassBlur, boxShadow: 'var(--shadow-card)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="8.5"
                stroke="var(--text-secondary)"
                strokeWidth="1.6"
              />
              <path
                d="M12 8v4l2.5 2.5"
                stroke="var(--text-secondary)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-[13px] font-medium text-[var(--text-primary)]">
            아직 노트가 없어요
          </p>
          <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
            우측 상단 + 버튼으로 뽀모도로나 일정을 추가해 보세요.
          </p>
        </div>
      )}
      {!isEmpty && (
        <div className="scroll-area flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
          {dates.map(date => {
            const dateNotes = notesByDate.get(date) ?? []
            const activeIds = dateNotes
              .filter(n => !isFinished(n))
              .map(n => n.id)
            return (
              <div key={date} className="flex flex-col gap-2.5">
                <DateHeading date={date} />
                {dateNotes.map(note =>
                  isFinished(note) ? (
                    <FinishedNoteRow
                      key={note.id}
                      note={note}
                      onDeleteRequest={() => setDeleteTarget(note)}
                    />
                  ) : note.type === 'pomodoro' ? (
                    <PomodoroCard
                      key={note.id}
                      note={note}
                      timer={timer}
                      isFirst={activeIds[0] === note.id}
                      isLast={activeIds[activeIds.length - 1] === note.id}
                      onDeleteRequest={() => setDeleteTarget(note)}
                    />
                  ) : (
                    <ScheduleNoteCard
                      key={note.id}
                      note={note}
                      timer={timer}
                      isFirst={activeIds[0] === note.id}
                      isLast={activeIds[activeIds.length - 1] === note.id}
                      onDeleteRequest={() => setDeleteTarget(note)}
                    />
                  ),
                )}
              </div>
            )
          })}
        </div>
      )}

      <NoteBottomSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
      />
      <SessionEndPopup />
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
