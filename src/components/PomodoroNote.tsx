import { useState } from 'react'
import NoteBottomSheet from './NoteBottomSheet'

export default function PomodoroNote() {
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  return (
    <div className="w-full h-[680px] flex flex-col overflow-hidden">
      <header className="flex items-center justify-between p-[12px] shrink-0">
        <h1 className="text-[20px] font-bold tracking-[-0.4px] text-[var(--text-primary)]">
          일정관리
        </h1>
        <button
          onClick={() => setIsSheetOpen(true)}
          className="w-6 h-6 rounded-full flex items-center justify-center border-0 outline-none cursor-pointer transition-colors duration-150 bg-[var(--bg-button)] text-white hover:bg-[var(--bg-button-hover)] active:bg-[var(--bg-button-active)]"
          aria-label="일정 추가"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M5 1v8M1 5h8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>
      <div className="h-px bg-[var(--border)] shrink-0" />
      <div className="scroll-area flex-1 overflow-y-auto" />

      <NoteBottomSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} />
    </div>
  )
}
