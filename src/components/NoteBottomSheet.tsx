import { useState, type CSSProperties, type ReactNode } from 'react'
import type { NoteType } from '../types/note'
import { useAppStore } from '../store/useAppStore'
import {
  DEFAULT_BREAK_DURATION,
  DEFAULT_TAGS,
  DEFAULT_WORK_DURATION,
  TAG_COLORS,
} from '../utils/constants'
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

// 선택 상태 칩 공통 스타일 — 틴트 배경 + 컬러 링 (프리셋·태그 공용)
const chipStyle = (
  selected: boolean,
  color = 'var(--color-accent)',
): CSSProperties =>
  selected
    ? {
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
        color,
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

// 입력값이 숫자가 아니면 0으로 정규화 (빈 칸 등)
const toNumber = (value: string): number => {
  const n = Number(value)
  return Number.isNaN(n) ? 0 : Math.max(0, n)
}

// 분 단위 값을 '시간 + 분' 두 입력으로 나눠 받음 — 세션 종료 팝업의 연장 세팅에서도 재사용
export const DurationInput = ({
  label,
  minutes,
  onChange,
}: {
  label: string
  minutes: number
  onChange: (totalMinutes: number) => void
}) => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  // 0은 '-' 플레이스홀더로 표시하고 포커스 시에는 숨겨 바로 입력 가능하게 함
  const inputClass =
    'w-6 bg-transparent text-[var(--text-primary)] text-[14px] font-semibold text-right outline-none border-0 min-w-0 placeholder:text-[var(--text-secondary)] focus:placeholder:text-transparent'
  const unitClass = 'text-[11px] text-[var(--text-secondary)] shrink-0'

  return (
    <div className="flex-1 flex items-center gap-1 bg-[var(--bg-primary)] rounded-[12px] px-2.5 py-3 transition-shadow duration-150 focus-within:shadow-[inset_0_0_0_1.5px_var(--color-accent)]">
      <span className="text-[12px] text-[var(--text-secondary)] shrink-0 mr-0.5">
        {label}
      </span>
      <input
        type="number"
        value={hours === 0 ? '' : hours}
        placeholder="-"
        onChange={e => onChange(toNumber(e.target.value) * 60 + mins)}
        className={inputClass}
      />
      <span className={unitClass}>시간</span>
      <input
        type="number"
        value={mins === 0 ? '' : mins}
        placeholder="-"
        onChange={e => onChange(hours * 60 + toNumber(e.target.value))}
        className={inputClass}
      />
      <span className={unitClass}>분</span>
    </div>
  )
}

const TimeInput = ({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) => (
  <div className="flex flex-1 items-center gap-1.5 bg-[var(--bg-primary)] rounded-[12px] px-3 py-[9px] transition-shadow duration-150 focus-within:shadow-[inset_0_0_0_1.5px_var(--color-accent)]">
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="flex-1 min-w-0 bg-transparent text-[var(--text-primary)] text-[13px] font-semibold outline-none border-0"
    />
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
  </div>
)

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
        className="absolute inset-0 bg-black/50 animate-[fade-in_0.2s_ease-out]"
        onClick={onClose}
      />

      <div className="relative z-20 bg-[var(--bg-card)] rounded-t-[24px] px-5 pt-4 pb-6 shadow-[0_-8px_32px_rgba(0,0,0,0.24)] animate-[slide-up_0.32s_cubic-bezier(0.32,0.72,0,1)]">
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
                      boxShadow: '0 1px 4px rgba(0,0,0,0.16)',
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
              {/* 시작 / 종료 시간 */}
              <div className="flex gap-2 mb-2">
                <TimeInput value={startTime} onChange={setStartTime} />
                <TimeInput value={endTime} onChange={setEndTime} />
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
          className="w-full py-[14px] rounded-[14px] text-[14px] font-semibold border-0 cursor-pointer text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-active)] active:scale-[0.99] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-accent)] disabled:active:scale-100"
        >
          저장하기
        </button>
      </div>

      {/* 생성 불가 알럿 */}
      {alertMessage && (
        <div className="fixed inset-0 z-30 flex items-center justify-center px-8">
          <div
            className="absolute inset-0 bg-black/50 animate-[fade-in_0.15s_ease-out]"
            onClick={() => setAlertMessage(null)}
          />
          <div className="relative z-10 w-full bg-[var(--bg-card)] rounded-[18px] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.28)] animate-[fade-in_0.15s_ease-out]">
            <p className="text-[15px] font-semibold text-[var(--text-primary)]">
              일정을 만들 수 없어요
            </p>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1.5">
              {alertMessage}
            </p>
            <button
              onClick={() => setAlertMessage(null)}
              className="w-full mt-5 py-2.5 rounded-[12px] text-[13px] font-semibold cursor-pointer border-0 text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] active:scale-[0.98] transition-all duration-150"
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
