// 로컬 타임존 기준 'YYYY-MM-DD' — 날짜 그룹 키 생성용
export const getTodayDate = (): string => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
