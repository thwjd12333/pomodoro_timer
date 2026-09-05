import type { CSSProperties } from 'react'

// 유리질 표면의 블러 — Tailwind/Lightning CSS 빌드가 접두사 없는 backdrop-filter
// 선언을 지워버려 클래스 대신 인라인 style로 직접 적용함 (.glass-surface는 배경색만 담당)
export const glassBlur: CSSProperties = {
  backdropFilter: 'var(--blur-glass)',
  WebkitBackdropFilter: 'var(--blur-glass)',
}

// 남은 시간 비율에 따라 액센트 → 경고색으로 연속적으로 번지는 다이얼 링 색
// (휴식 단계는 서두를 이유가 없으므로 고정된 차분한 색을 씀)
export const ringColorFor = (
  progress: number,
  phase?: 'work' | 'break',
): string => {
  if (phase === 'break') return 'var(--color-break)'
  const urgency = Math.pow(Math.max(0, Math.min(1, 1 - progress)), 3) * 100
  return `color-mix(in srgb, var(--color-urgent) ${urgency}%, var(--color-accent))`
}
