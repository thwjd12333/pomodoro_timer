import type { ScheduleNote as ScheduleNoteData } from '../types/note'
import type { TimerState } from '../types/timer'
import { useAppStore } from '../store/useAppStore'
import { DEFAULT_TAGS, TAG_COLORS } from '../utils/constants'
import { formatDuration, formatTime } from '../utils/formatters'
import { minutesBetween } from '../utils/timeUtils'
import { ActionButton, NoteCardFrame } from './noteCardParts'

// 일정 타이머 카드 — 대기 중엔 시작 안내, 시작하면 종료 시각까지 남은 시간 카운트다운
const ScheduleNoteCard = ({
  note,
  timer,
  onDeleteRequest,
}: {
  note: ScheduleNoteData
  timer: TimerState
  onDeleteRequest: () => void
}) => {
  const startTimer = useAppStore(s => s.startTimer)
  const completeNote = useAppStore(s => s.completeNote)

  const tag = DEFAULT_TAGS.find(t => t.id === note.tagId)
  const isRunning = note.status === 'running' && timer.noteId === note.id
  const progress =
    isRunning && timer.total > 0 ? timer.remaining / timer.total : 0
  const duration = formatDuration(minutesBetween(note.startTime, note.endTime))

  return (
    <NoteCardFrame
      type="schedule"
      status={note.status}
      title={note.title}
      subtitle={`${note.startTime} — ${note.endTime} · ${duration}`}
      display={isRunning ? formatTime(timer.remaining) : '시작 대기 중'}
      displayMuted={!isRunning}
      progress={progress}
      infoLeft={isRunning ? `${note.endTime} 종료` : `${note.startTime} 시작`}
      actions={
        isRunning ? (
          <ActionButton
            label="완료"
            primary
            onClick={() => completeNote(note.id)}
          />
        ) : (
          <ActionButton label="지금 시작" onClick={() => startTimer(note.id)} />
        )
      }
      tagColor={tag ? TAG_COLORS[tag.color] : undefined}
      onDeleteRequest={onDeleteRequest}
    />
  )
}

export default ScheduleNoteCard
