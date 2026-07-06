// 'YYYY-MM-DD' → '4월 26일 토요일'
export const formatDateHeading = (date: string): string => {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
}

// 초 → 'MM:SS', 1시간 이상이면 'H:MM:SS' (예: 1:30:00)
export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  const mmss = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return hours > 0 ? `${hours}:${mmss}` : mmss
}

// 분 → '50분' / '1시간' / '1시간 30분'
export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}분`
  return mins === 0 ? `${hours}시간` : `${hours}시간 ${mins}분`
}
