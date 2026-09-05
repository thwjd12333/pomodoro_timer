import type { ScheduleNote as ScheduleNoteData } from '../types/note'
import type { TimerState } from '../types/timer'
import { useAppStore } from '../store/useAppStore'
import { DEFAULT_TAGS, TAG_COLORS, TYPE_META } from '../utils/constants'
import { ringColorFor } from '../utils/colorUtils'
import { formatDuration, formatTime } from '../utils/formatters'
import { minutesBetween } from '../utils/timeUtils'
import { ActionButton, NoteCardFrame, NoteHero } from './NoteCardParts'

// 일정 타이머 카드 — 대기 중엔 시작 안내, 시작하면 종료 시각까지 남은 시간 카운트다운.
// 지금 타이머를 쥐고 있을 때만 히어로 위젯, 그 외엔 압축 카드
const ScheduleNoteCard = ({
  note,
  timer,
  isFirst,
  isLast,
  onDeleteRequest,
}: {
  note: ScheduleNoteData
  timer: TimerState
  isFirst: boolean
  isLast: boolean
  onDeleteRequest: () => void
}) => {
  const startTimer = useAppStore(s => s.startTimer)
  const completeNote = useAppStore(s => s.completeNote)
  const moveNoteUp = useAppStore(s => s.moveNoteUp)
  const moveNoteDown = useAppStore(s => s.moveNoteDown)

  const tag = DEFAULT_TAGS.find(t => t.id === note.tagId)
  const tagColor = tag ? TAG_COLORS[tag.color] : undefined
  const isRunning = note.status === 'running' && timer.noteId === note.id
  const progress =
    isRunning && timer.total > 0 ? timer.remaining / timer.total : 0
  const duration = formatDuration(minutesBetween(note.startTime, note.endTime))

  const actions = isRunning ? (
    <ActionButton label="완료" primary onClick={() => completeNote(note.id)} />
  ) : (
    <ActionButton label="지금 시작" onClick={() => startTimer(note.id)} />
  )

  if (isRunning)
    return (
      <NoteHero
        type="schedule"
        status={note.status}
        title={note.title}
        subtitle={`${note.startTime} — ${note.endTime} · ${duration}`}
        display={formatTime(timer.remaining)}
        progress={progress}
        ringColor={ringColorFor(progress)}
        phaseLabel={`${note.endTime} 종료`}
        phaseColor={TYPE_META.schedule.color}
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
      type="schedule"
      status={note.status}
      title={note.title}
      subtitle={`${note.startTime} — ${note.endTime} · ${duration}`}
      display={`${note.startTime} 시작`}
      showTimer={false}
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

export default ScheduleNoteCard
