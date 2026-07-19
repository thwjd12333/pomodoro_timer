// 로컬 타임존 기준 'YYYY-MM-DD' — 날짜 그룹 키 생성용
export const getTodayDate = (): string => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// 'HH:mm' 두 시각 사이의 분 차이 (end가 start보다 빠르면 0)
export const minutesBetween = (start: string, end: string): number => {
  const toMinutes = (time: string): number => {
    const [hours, mins] = time.split(':').map(Number)
    return hours * 60 + mins
  }
  return Math.max(0, toMinutes(end) - toMinutes(start))
}

// 로컬 타임존 기준 현재 시각 'HH:mm'
export const getCurrentTime = (): string => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

// 'HH:mm'에 분을 더함 (자정을 넘기면 23:59로 제한)
export const addMinutes = (time: string, minutes: number): string => {
  const [hours, mins] = time.split(':').map(Number)
  const total = Math.min(hours * 60 + mins + minutes, 23 * 60 + 59)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// 일정 타이머 기본 시간 — 시작은 현재 시의 정각(HH:00), 종료는 +1시간 (자정을 넘기면 23:59로 제한)
export const getDefaultScheduleTimes = (): { start: string; end: string } => {
  const hour = new Date().getHours()
  const pad = (h: number) => String(h).padStart(2, '0')
  return {
    start: `${pad(hour + 1)}:00`,
    end: hour < 23 ? `${pad(hour + 2)}:00` : '23:59',
  }
}

// 지금부터 오늘 'HH:mm' 시각까지 남은 초 (이미 지났으면 0)
export const secondsUntilToday = (time: string): number => {
  const [hours, mins] = time.split(':').map(Number)
  const target = new Date()
  target.setHours(hours, mins, 0, 0)
  return Math.max(0, Math.round((target.getTime() - Date.now()) / 1000))
}
