import { useState } from 'react'
import type { PomodoroNote } from '../types/note'
import {
  findNextNote,
  useAppStore,
  type PendingDecision,
} from '../store/useAppStore'
import { DurationInput } from './NoteBottomSheet'

type Step = 'confirm' | 'choose' | 'extend' | 'breakEnd'

const STEP_TITLE: Record<Step, string> = {
  confirm: '일정을 완료하셨나요?',
  choose: '일정을 완료하셨나요?',
  extend: '얼마나 연장할까요?',
  breakEnd: '다음 세션을 시작할까요?',
}

const buttonClass = (variant: 'outline' | 'accent') =>
  variant === 'accent'
    ? 'flex-1 py-2.5 rounded-[12px] text-[13px] font-semibold cursor-pointer border-0 text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed'
    : 'flex-1 py-2.5 rounded-[12px] text-[13px] font-semibold cursor-pointer bg-transparent text-[var(--text-primary)] border border-solid border-[var(--border)] hover:bg-[var(--bg-card-hover)] active:scale-[0.98] transition-all duration-150'

// 결정 플로우 — 집중 종료: 완료 확인 → 연장/넘기기 → 연장 세팅, 휴식 종료: 다음 세션 진행 여부
const PopupContent = ({
  note,
  kind,
}: {
  note: PomodoroNote
  kind: PendingDecision['kind']
}) => {
  const startBreak = useAppStore(s => s.startBreak)
  const skipEndedNote = useAppStore(s => s.skipEndedNote)
  const extendNote = useAppStore(s => s.extendNote)
  const startNextSession = useAppStore(s => s.startNextSession)
  const finishNote = useAppStore(s => s.finishNote)
  const notes = useAppStore(s => s.notes)

  const [step, setStep] = useState<Step>(
    kind === 'breakEnd' ? 'breakEnd' : 'confirm',
  )
  const [extraMin, setExtraMin] = useState(note.workDuration)
  const nextNote = kind === 'breakEnd' ? findNextNote(note, notes) : null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-8">
      <div className="absolute inset-0 bg-black/50 animate-[fade-in_0.15s_ease-out]" />
      <div className="relative z-10 w-full bg-[var(--bg-card)] rounded-[18px] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.28)] animate-[fade-in_0.15s_ease-out]">
        <p className="text-[15px] font-semibold text-[var(--text-primary)]">
          {STEP_TITLE[step]}
        </p>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1.5 break-all">
          {step === 'confirm' &&
            `'${note.title}' 집중 세션이 끝났어요. 완료하면 휴식을 시작해요.`}
          {step === 'choose' && '연장하거나 다음 일정으로 넘어갈 수 있어요.'}
          {step === 'extend' && '저장하면 연장 세션이 바로 시작돼요.'}
          {step === 'breakEnd' && `'${note.title}' 휴식이 끝났어요.`}
        </p>

        {step === 'extend' && (
          <div className="flex mt-4">
            <DurationInput
              label="연장"
              minutes={extraMin}
              onChange={setExtraMin}
            />
          </div>
        )}

        <div className="flex gap-2 mt-5">
          {step === 'confirm' && (
            <>
              <button
                onClick={() => setStep('choose')}
                className={buttonClass('outline')}
              >
                아니요
              </button>
              <button onClick={startBreak} className={buttonClass('accent')}>
                네
              </button>
            </>
          )}
          {step === 'choose' && (
            <>
              <button
                onClick={skipEndedNote}
                className={buttonClass('outline')}
              >
                넘기기
              </button>
              <button
                onClick={() => setStep('extend')}
                className={buttonClass('accent')}
              >
                연장하기
              </button>
            </>
          )}
          {step === 'extend' && (
            <>
              <button
                onClick={() => setStep('choose')}
                className={buttonClass('outline')}
              >
                뒤로
              </button>
              <button
                onClick={() => extendNote(extraMin)}
                disabled={extraMin < 1}
                className={buttonClass('accent')}
              >
                저장
              </button>
            </>
          )}
          {step === 'breakEnd' && (
            <>
              <button onClick={finishNote} className={buttonClass('outline')}>
                그만하기
              </button>
              <button
                onClick={startNextSession}
                disabled={!nextNote}
                className={buttonClass('accent')}
              >
                시작하기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// 응답 대기 중인 결정이 있을 때만 표시 — 노트·결정 종류가 바뀌면 스텝 상태도 초기화
const SessionEndPopup = () => {
  const decision = useAppStore(s => s.pendingDecision)
  const notes = useAppStore(s => s.notes)
  const note = notes.find(n => n.id === decision?.noteId)

  if (!decision || !note || note.type !== 'pomodoro') return null
  return (
    <PopupContent
      key={`${note.id}-${decision.kind}`}
      note={note}
      kind={decision.kind}
    />
  )
}

export default SessionEndPopup
