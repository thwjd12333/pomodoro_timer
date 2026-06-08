import { useState } from 'react'

type NoteType = 'pomodoro' | 'schedule'
type RepeatType = 'none' | 'daily' | 'weekdays'

interface Props {
  isOpen: boolean
  onClose: () => void
}

const TAGS = [
  { id: 'work', label: '업무', color: '#7F77DD' },
  { id: 'personal', label: '개인', color: '#1D9E75' },
  { id: 'study', label: '공부', color: '#BA7517' },
]

const REPEAT_OPTIONS: [RepeatType, string][] = [
  ['none', '없음'],
  ['daily', '매일'],
  ['weekdays', '평일'],
]

const PRESETS: [number, number, string][] = [
  [25, 5, '25분 / 5분'],
  [50, 10, '50분 / 10분'],
]

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <div
    onClick={() => onChange(!value)}
    className="relative w-[44px] h-[26px] rounded-full cursor-pointer transition-colors duration-200 shrink-0"
    style={{ backgroundColor: value ? 'var(--color-accent)' : 'var(--border)' }}
  >
    <div
      className="absolute top-[3px] w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200"
      style={{ left: value ? '21px' : '3px' }}
    />
  </div>
)

const TimeInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="flex flex-1">
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 min-w-0 rounded-l-[10px] px-2.5 py-[9px] bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] text-[13px] font-semibold outline-none focus:border-[var(--color-accent)]"
    />
    <span className="inline-flex items-center px-2 bg-[var(--bg-primary)] border border-l-0 border-[var(--border)] rounded-r-[10px] text-[var(--text-secondary)]">
      <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    </span>
  </div>
)

const NoteBottomSheet = ({ isOpen, onClose }: Props) => {
  const [type, setType] = useState<NoteType>('pomodoro')
  const [title, setTitle] = useState('')
  const [workDuration, setWorkDuration] = useState(50)
  const [breakDuration, setBreakDuration] = useState(10)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [notifyOnStart, setNotifyOnStart] = useState(true)
  const [notifyOnEnd, setNotifyOnEnd] = useState(true)
  const [tagId, setTagId] = useState<string | null>(null)
  const [repeat, setRepeat] = useState<RepeatType>('none')

  if (!isOpen) return null

  const isPreset = (w: number, b: number) => workDuration === w && breakDuration === b

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative z-20 bg-[var(--bg-card)] rounded-t-[24px] px-5 pt-4 pb-6">
        <div className="w-9 h-1 bg-[var(--border)] rounded-full mx-auto mb-5" />

        {/* 타입 탭 */}
        <div className="flex bg-[var(--bg-primary)] rounded-[14px] p-1 mb-5">
          {(['pomodoro', 'schedule'] as NoteType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="flex-1 py-[9px] rounded-[10px] text-[13px] font-semibold border-0 outline-none cursor-pointer transition-colors duration-150"
              style={
                type === t
                  ? { backgroundColor: 'var(--color-accent)', color: '#fff' }
                  : { backgroundColor: 'transparent', color: 'var(--text-secondary)' }
              }
            >
              {t === 'pomodoro' ? '뽀모도로' : '일정 타이머'}
            </button>
          ))}
        </div>

        {/* 제목 */}
        <div className="mb-4">
          <p className="text-[11px] text-[var(--text-secondary)] mb-1.5 font-medium">제목</p>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="노트 제목을 입력하세요"
            className="w-full bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-[12px] px-4 py-3 text-[14px] border-0 outline-none placeholder:text-[var(--text-secondary)]"
          />
        </div>

        {/* 가변 영역 — 두 탭 높이 통일 */}
        <div className="mb-4 min-h-[120px]">

          {/* 뽀모도로 */}
          {type === 'pomodoro' && (
            <div>
              <p className="text-[11px] text-[var(--text-secondary)] mb-1.5 font-medium">시간 설정</p>
              <div className="flex gap-2 mb-2">
                {PRESETS.map(([w, b, label]) => (
                  <button
                    key={label}
                    onClick={() => { setWorkDuration(w); setBreakDuration(b) }}
                    className="flex-1 py-2 rounded-[10px] text-[12px] font-medium border-0 cursor-pointer transition-colors duration-150"
                    style={
                      isPreset(w, b)
                        ? { backgroundColor: 'var(--color-accent)', color: '#fff' }
                        : { backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {([['작업', workDuration, setWorkDuration], ['휴식', breakDuration, setBreakDuration]] as [string, number, (v: number) => void][]).map(
                  ([label, value, setter]) => (
                    <div key={label} className="flex-1 flex items-center gap-1.5 bg-[var(--bg-primary)] rounded-[12px] px-3 py-3">
                      <span className="text-[12px] text-[var(--text-secondary)] shrink-0">{label}</span>
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => setter(Number(e.target.value))}
                        className="w-8 bg-transparent text-[var(--text-primary)] text-[14px] text-right outline-none border-0 min-w-0"
                      />
                      <span className="text-[12px] text-[var(--text-secondary)] shrink-0">분</span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* 일정 타이머 */}
          {type === 'schedule' && (
            <div>
              <p className="text-[11px] text-[var(--text-secondary)] mb-1.5 font-medium">시간</p>
              {/* 시작 / 종료 시간 */}
              <div className="flex gap-2 mb-2">
                <TimeInput value={startTime} onChange={setStartTime} /> 
                <TimeInput value={endTime} onChange={setEndTime} />
              </div>
              {/* 알림 토글 */}
              <div className="flex gap-2">
                {([
                  ['시작 알림', notifyOnStart, setNotifyOnStart],
                  ['종료 알림', notifyOnEnd, setNotifyOnEnd],
                ] as [string, boolean, (v: boolean) => void][]).map(([label, value, setter]) => (
                  <div key={label} className="flex-1 flex items-center justify-between bg-[var(--bg-primary)] rounded-[10px] px-3 py-[9px]">
                    <span className="text-[11px] text-[var(--text-primary)]">{label}</span>
                    <Toggle value={value} onChange={setter} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 태그 */}
        <div className="mb-4">
          <p className="text-[11px] text-[var(--text-secondary)] mb-1.5 font-medium">태그</p>
          <div className="flex gap-2">
            {TAGS.map((tag) => (
              <button
                key={tag.id}
                onClick={() => setTagId(tagId === tag.id ? null : tag.id)}
                className="px-3 py-1.5 rounded-full text-[12px] font-medium border-0 cursor-pointer transition-all duration-150"
                style={{
                  backgroundColor: tagId === tag.id ? `${tag.color}28` : 'var(--bg-primary)',
                  color: tagId === tag.id ? tag.color : 'var(--text-secondary)',
                  outline: tagId === tag.id ? `1.5px solid ${tag.color}` : 'none',
                }}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        {/* 반복 */}
        <div className="mb-6">
          <p className="text-[11px] text-[var(--text-secondary)] mb-1.5 font-medium">반복</p>
          <div className="flex gap-2">
            {REPEAT_OPTIONS.map(([val, label]) => (
              <button
                key={val}
                onClick={() => setRepeat(val)}
                className="px-3 py-1.5 rounded-full text-[12px] font-medium border-0 cursor-pointer transition-colors duration-150"
                style={
                  repeat === val
                    ? { backgroundColor: 'var(--color-accent)', color: '#fff' }
                    : { backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 저장 버튼 */}
        <button
          className="w-full py-[14px] rounded-[14px] text-[14px] font-semibold border-0 cursor-pointer transition-colors duration-150 text-white"
          style={{ backgroundColor: 'var(--color-accent)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-accent)')}
        >
          저장하기
        </button>
      </div>
    </div>
  )
}

export default NoteBottomSheet
