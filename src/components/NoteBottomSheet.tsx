import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type { NoteType } from '../types/note'
import { useAppStore } from '../store/useAppStore'
import {
  DEFAULT_BREAK_DURATION,
  DEFAULT_TAGS,
  DEFAULT_WORK_DURATION,
  TAG_COLORS,
} from '../utils/constants'
import { glassBlur } from '../utils/colorUtils'
import { formatDuration } from '../utils/formatters'
import {
  getDefaultScheduleTimes,
  getTodayDate,
  secondsUntilToday,
} from '../utils/timeUtils'

interface Props {
  isOpen: boolean
  onClose: () => void
}

const PRESETS: [number, number, string][] = [
  [25, 5, '25분 / 5분'],
  [50, 10, '50분 / 10분'],
]

// 선택 상태 칩 공통 스타일 — 틴트 배경 + 컬러 링 (프리셋·태그 공용).
// 글자색은 항상 중립(text-primary)으로 두고 색은 배경 틴트·링에만 써서
// 다크모드에서도 대비가 항상 보장되게 함
const chipStyle = (
  selected: boolean,
  color = 'var(--color-accent)',
): CSSProperties =>
  selected
    ? {
        backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
        color: 'var(--text-primary)',
        boxShadow: `inset 0 0 0 1.5px ${color}`,
      }
    : { backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <p className="text-[11px] text-[var(--text-secondary)] mb-1.5 font-medium">
    {children}
  </p>
)

const Toggle = ({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) => (
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

// 라벨 + 토글 한 줄 필드 (뽀모도로·일정 알림 설정 공용)
const ToggleField = ({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) => (
  <div className="flex-1 flex items-center justify-between bg-[var(--bg-primary)] rounded-[10px] px-3 py-[9px]">
    <span className="text-[11px] text-[var(--text-primary)]">{label}</span>
    <Toggle value={value} onChange={onChange} />
  </div>
)

// 뽀모도로는 관습적으로 5분 단위를 쓰므로 스텝/최솟값도 5분으로 고정
const DURATION_STEP = 5
const MIN_DURATION = 5

const StepperButton = ({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-[13px] font-semibold border-0 cursor-pointer bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] active:scale-90 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
  >
    {label}
  </button>
)

// 5분 단위 +/- 스테퍼 + 직접 입력(총 분 단위 숫자) 겸용 —
// 편집 중엔 입력한 숫자 그대로, 포커스를 벗어나면 formatDuration으로 재포맷
// (예: '90' 입력 → blur 시 '1시간 30분'). 세션 종료 팝업의 연장 세팅에서도 재사용
export const DurationInput = ({
  label,
  minutes,
  onChange,
}: {
  label: string
  minutes: number
  onChange: (totalMinutes: number) => void
}) => {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    if (draft === null) return
    const parsed = Number(draft)
    if (draft !== '' && !Number.isNaN(parsed))
      onChange(Math.max(MIN_DURATION, parsed))
    setDraft(null)
  }

  return (
    <div className="flex-1 min-w-0 flex items-center gap-1 bg-[var(--bg-primary)] rounded-[12px] px-1.5 py-2">
      <span className="text-[11px] text-[var(--text-secondary)] shrink-0">
        {label}
      </span>
      {/* 남은 공간을 전부 차지해 '1시간 10분'처럼 길어져도 잘리지 않음 */}
      <div className="flex-1 min-w-0 flex items-center justify-end gap-1">
        <StepperButton
          label="−"
          onClick={() =>
            onChange(Math.max(MIN_DURATION, minutes - DURATION_STEP))
          }
          disabled={minutes <= MIN_DURATION}
        />
        <input
          type="text"
          inputMode="numeric"
          value={draft ?? formatDuration(minutes)}
          onFocus={() => setDraft(String(minutes))}
          onChange={e => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commit}
          onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
          className="flex-1 min-w-0 bg-transparent text-center text-[10px] font-semibold text-[var(--text-primary)] outline-none border-0 tabular-nums"
        />
        <StepperButton
          label="+"
          onClick={() => onChange(minutes + DURATION_STEP)}
        />
      </div>
    </div>
  )
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)
const WHEEL_ITEM_HEIGHT = 32
const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * 3 // 위/가운데(선택)/아래 3줄만 보여줌

// 분 값을 휠에 있는 가장 가까운 5분 단위로 보정 — 저장된 값 자체는 바꾸지 않고 표시용으로만 사용
const snapMinute = (m: number): number =>
  MINUTES.reduce((closest, candidate) =>
    Math.abs(candidate - m) < Math.abs(closest - m) ? candidate : closest,
  )

// 스크롤/드래그로 값을 고르는 휠 한 칸 — 시·분 선택 공용
const WheelColumn = ({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: number[]
  value: number
  onChange: (v: number) => void
  ariaLabel: string
}) => {
  const listRef = useRef<HTMLDivElement>(null)
  const commitTimer = useRef<number | undefined>(undefined)
  const index = Math.max(0, options.indexOf(value))

  // 값이 외부에서 바뀌면(다른 시간으로 전환 등) 그 위치로 스크롤 위치를 맞춤
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const target = index * WHEEL_ITEM_HEIGHT
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target
  }, [index])

  const commitFromScroll = () => {
    const el = listRef.current
    if (!el) return
    const nextIndex = Math.min(
      options.length - 1,
      Math.max(0, Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT)),
    )
    if (options[nextIndex] !== value) onChange(options[nextIndex])
  }

  const step = (delta: number) => {
    const next = Math.min(options.length - 1, Math.max(0, index + delta))
    onChange(options[next])
  }

  return (
    <div className="relative" style={{ height: WHEEL_HEIGHT }}>
      {/* 가운데(선택) 줄 강조 — 스크롤과 무관한 고정 오버레이 */}
      <div
        className="pointer-events-none absolute inset-x-0 rounded-[8px] bg-[var(--bg-card-hover)]"
        style={{ top: WHEEL_ITEM_HEIGHT, height: WHEEL_ITEM_HEIGHT }}
      />
      <div
        ref={listRef}
        role="listbox"
        aria-label={ariaLabel}
        tabIndex={0}
        onScroll={() => {
          window.clearTimeout(commitTimer.current)
          commitTimer.current = window.setTimeout(commitFromScroll, 100)
        }}
        onKeyDown={e => {
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            step(-1)
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            step(1)
          }
        }}
        className="scroll-area relative h-full w-11 overflow-y-auto outline-none [scroll-snap-type:y_mandatory]"
      >
        <div style={{ height: WHEEL_ITEM_HEIGHT }} />
        {options.map(opt => (
          <div
            key={opt}
            role="option"
            aria-selected={opt === value}
            onClick={() => onChange(opt)}
            className="flex cursor-pointer items-center justify-center tabular-nums transition-[color,opacity,font-size] duration-150 [scroll-snap-align:center]"
            style={{
              height: WHEEL_ITEM_HEIGHT,
              fontSize: opt === value ? 16 : 13,
              fontWeight: opt === value ? 700 : 500,
              color: opt === value ? 'var(--text-primary)' : 'var(--text-secondary)',
              opacity: opt === value ? 1 : 0.55,
            }}
          >
            {pad2(opt)}
          </div>
        ))}
        <div style={{ height: WHEEL_ITEM_HEIGHT }} />
      </div>
    </div>
  )
}

// 시작/종료 시각을 여는 칩 — 탭하면 바로 아래에 휠 피커가 펼쳐짐
const TimeChip = ({
  label,
  value,
  active,
  onClick,
}: {
  label: string
  value: string
  active: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex flex-1 min-w-0 items-center gap-1.5 rounded-[12px] bg-[var(--bg-primary)] px-3 py-[9px] text-left transition-shadow duration-150"
    style={
      active
        ? { boxShadow: 'inset 0 0 0 1.5px var(--color-accent)' }
        : undefined
    }
  >
    <span className="shrink-0 text-[11px] text-[var(--text-secondary)]">
      {label}
    </span>
    <span className="min-w-0 flex-1 truncate tabular-nums text-[13px] font-semibold text-[var(--text-primary)]">
      {value}
    </span>
    <svg
      className="w-[14px] h-[14px] shrink-0 text-[var(--text-secondary)]"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  </button>
)

// 칩 아래 펼쳐지는 시:분 휠 페어
const TimeWheelPanel = ({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) => {
  const [hour, minute] = value.split(':').map(Number)
  return (
    <div className="mt-2 flex items-center justify-center gap-1 rounded-[12px] bg-[var(--bg-primary)] px-3 py-2">
      <WheelColumn
        options={HOURS}
        value={hour}
        onChange={nextHour => onChange(`${pad2(nextHour)}:${pad2(minute)}`)}
        ariaLabel="시"
      />
      <span className="pb-px text-[15px] font-bold text-[var(--text-secondary)]">
        :
      </span>
      <WheelColumn
        options={MINUTES}
        value={snapMinute(minute)}
        onChange={nextMinute => onChange(`${pad2(hour)}:${pad2(nextMinute)}`)}
        ariaLabel="분"
      />
    </div>
  )
}

// 열릴 때마다 새로 마운트되어 폼이 항상 초기 상태로 시작됨 (일정 기본 시간도 현재 시각 기준)
const SheetContent = ({ onClose }: { onClose: () => void }) => {
  const addNote = useAppStore(s => s.addNote)

  const [type, setType] = useState<NoteType>('pomodoro')
  const [title, setTitle] = useState('')
  const [workDuration, setWorkDuration] = useState(DEFAULT_WORK_DURATION)
  const [breakDuration, setBreakDuration] = useState(DEFAULT_BREAK_DURATION)
  const [startTime, setStartTime] = useState(
    () => getDefaultScheduleTimes().start,
  )
  const [endTime, setEndTime] = useState(() => getDefaultScheduleTimes().end)
  const [openTimeField, setOpenTimeField] = useState<'start' | 'end' | null>(
    null,
  )
  const [notifyOnStart, setNotifyOnStart] = useState(true)
  const [notifyOnEnd, setNotifyOnEnd] = useState(true)
  const [notifyOnComplete, setNotifyOnComplete] = useState(true)
  const [tagId, setTagId] = useState<string | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  const isPreset = (w: number, b: number) =>
    workDuration === w && breakDuration === b

  const defaultTitle = type === 'pomodoro' ? '뽀모도로 타이머' : '일정 타이머'

  const canSave =
    type === 'pomodoro'
      ? workDuration >= 1 && breakDuration >= 1
      : startTime < endTime

  const handleSave = () => {
    // 이미 지난 완료 시간으로는 일정을 만들 수 없음
    if (type === 'schedule' && secondsUntilToday(endTime) <= 0) {
      setAlertMessage(
        '완료 시간이 현재 시간보다 이전이에요. 시간을 다시 설정해 주세요.',
      )
      return
    }
    const base = {
      id: crypto.randomUUID(),
      title: title.trim() || defaultTitle,
      status: 'idle' as const,
      createdAt: Date.now(),
      date: getTodayDate(),
      tagId,
    }
    // 사운드는 별도 설정 UI가 생기기 전까지 알림 토글을 따름
    addNote(
      type === 'pomodoro'
        ? {
            ...base,
            type: 'pomodoro',
            workDuration,
            breakDuration,
            sessionCount: 0,
            extendedMinutes: 0,
            suspendedTimer: null,
            notifyOnComplete,
            soundOnComplete: notifyOnComplete,
          }
        : {
            ...base,
            type: 'schedule',
            startTime,
            endTime,
            notifyOnStart,
            notifyOnEnd,
            soundOnStart: notifyOnStart,
            soundOnEnd: notifyOnEnd,
          },
    )
    onClose()
  }

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-[var(--scrim)] animate-[fade-in_0.2s_ease-out]"
        onClick={onClose}
      />

      <div
        className="glass-surface relative z-20 rounded-t-[var(--radius-hero)] border-t border-x border-[var(--border)] px-5 pt-4 pb-6 animate-[slide-up_0.32s_cubic-bezier(0.32,0.72,0,1)]"
        style={{ ...glassBlur, boxShadow: 'var(--shadow-sheet)' }}
      >
        <div className="w-9 h-1 bg-[var(--border)] rounded-full mx-auto mb-5" />

        {/* 타입 탭 */}
        <div className="flex bg-[var(--bg-primary)] rounded-[14px] p-1 mb-5">
          {(['pomodoro', 'schedule'] as NoteType[]).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="flex-1 py-[9px] rounded-[10px] text-[13px] font-semibold border-0 outline-none cursor-pointer transition-all duration-150"
              style={
                type === t
                  ? {
                      backgroundColor: 'var(--color-accent)',
                      color: '#fff',
                      boxShadow: 'var(--shadow-card)',
                    }
                  : {
                      backgroundColor: 'transparent',
                      color: 'var(--text-secondary)',
                    }
              }
            >
              {t === 'pomodoro' ? '뽀모도로' : '일정 타이머'}
            </button>
          ))}
        </div>

        {/* 제목 */}
        <div className="mb-4">
          <SectionLabel>제목</SectionLabel>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={`미입력 시 '${defaultTitle}'로 생성돼요`}
            className="w-full bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-[12px] px-4 py-3 text-[14px] border-0 outline-none placeholder:text-[var(--text-secondary)] transition-shadow duration-150 focus:shadow-[inset_0_0_0_1.5px_var(--color-accent)]"
          />
        </div>

        {/* 가변 영역 — 두 탭 높이 통일 */}
        <div className="mb-4 min-h-[120px]">
          {/* 뽀모도로 */}
          {type === 'pomodoro' && (
            <div>
              <SectionLabel>시간 설정</SectionLabel>
              <div className="flex gap-2 mb-2">
                {PRESETS.map(([w, b, label]) => (
                  <button
                    key={label}
                    onClick={() => {
                      setWorkDuration(w)
                      setBreakDuration(b)
                    }}
                    className="flex-1 py-2 rounded-[10px] text-[12px] font-medium border-0 cursor-pointer transition-all duration-150"
                    style={chipStyle(isPreset(w, b))}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mb-2">
                <DurationInput
                  label="작업"
                  minutes={workDuration}
                  onChange={setWorkDuration}
                />
                <DurationInput
                  label="휴식"
                  minutes={breakDuration}
                  onChange={setBreakDuration}
                />
              </div>
              {/* 세션 완료·휴식 종료 알림 on/off */}
              <div className="flex">
                <ToggleField
                  label="세션 알림"
                  value={notifyOnComplete}
                  onChange={setNotifyOnComplete}
                />
              </div>
            </div>
          )}

          {/* 일정 타이머 */}
          {type === 'schedule' && (
            <div>
              <SectionLabel>시간</SectionLabel>
              {/* 시작 / 종료 시간 — 칩을 탭하면 아래에 휠 피커가 펼쳐짐 */}
              <div className="mb-2">
                <div className="flex gap-2">
                  <TimeChip
                    label="시작"
                    value={startTime}
                    active={openTimeField === 'start'}
                    onClick={() =>
                      setOpenTimeField(f => (f === 'start' ? null : 'start'))
                    }
                  />
                  <TimeChip
                    label="종료"
                    value={endTime}
                    active={openTimeField === 'end'}
                    onClick={() =>
                      setOpenTimeField(f => (f === 'end' ? null : 'end'))
                    }
                  />
                </div>
                {openTimeField && (
                  <TimeWheelPanel
                    value={openTimeField === 'start' ? startTime : endTime}
                    onChange={v =>
                      openTimeField === 'start' ? setStartTime(v) : setEndTime(v)
                    }
                  />
                )}
              </div>
              {/* 시작·종료 알림 on/off */}
              <div className="flex gap-2">
                <ToggleField
                  label="시작 알림"
                  value={notifyOnStart}
                  onChange={setNotifyOnStart}
                />
                <ToggleField
                  label="종료 알림"
                  value={notifyOnEnd}
                  onChange={setNotifyOnEnd}
                />
              </div>
            </div>
          )}
        </div>

        {/* 태그 */}
        <div className="mb-6">
          <SectionLabel>태그</SectionLabel>
          <div className="flex gap-2">
            {DEFAULT_TAGS.map(tag => (
              <button
                key={tag.id}
                onClick={() => setTagId(tagId === tag.id ? null : tag.id)}
                className="px-3 py-1.5 rounded-full text-[12px] font-medium border-0 cursor-pointer transition-all duration-150"
                style={chipStyle(tagId === tag.id, TAG_COLORS[tag.color])}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="w-full py-[14px] rounded-full text-[14px] font-semibold border-0 cursor-pointer text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-active)] active:scale-[0.99] transition-transform duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-accent)] disabled:active:scale-100"
        >
          저장하기
        </button>
      </div>

      {/* 생성 불가 알럿 */}
      {alertMessage && (
        <div className="fixed inset-0 z-30 flex items-center justify-center px-8">
          <div
            className="absolute inset-0 bg-[var(--scrim)] animate-[fade-in_0.15s_ease-out]"
            onClick={() => setAlertMessage(null)}
          />
          <div
            className="glass-surface relative z-10 w-full rounded-[var(--radius-card)] border border-[var(--border)] p-5 animate-[fade-in_0.15s_ease-out]"
            style={{ ...glassBlur, boxShadow: 'var(--shadow-pop)' }}
          >
            <p className="text-[15px] font-semibold text-[var(--text-primary)]">
              일정을 만들 수 없어요
            </p>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1.5">
              {alertMessage}
            </p>
            <button
              onClick={() => setAlertMessage(null)}
              className="w-full mt-5 py-2.5 rounded-full text-[13px] font-semibold cursor-pointer border-0 text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] active:scale-[0.98] transition-transform duration-150"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const NoteBottomSheet = ({ isOpen, onClose }: Props) =>
  isOpen ? <SheetContent onClose={onClose} /> : null

export default NoteBottomSheet
