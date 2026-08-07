/** Date → "20260805" (백엔드가 하이픈 없는 형식을 쓴다) */
export function toYmd(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

export function daysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

/** "20260805" → "2026-08-05" (lightweight-charts가 이 형식을 받는다) */
export function toDashedYmd(ymd: string): string {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
}

/** "20260805" → "8월 5일" (화면에 읽히는 형태). 해가 바뀌면 연도까지 적는다 */
export function toKoreanDate(ymd: string, today: Date = new Date()): string {
  const year = ymd.slice(0, 4)
  const month = Number(ymd.slice(4, 6))
  const day = Number(ymd.slice(6, 8))
  const prefix = year === String(today.getFullYear()) ? '' : `${year}년 `

  return `${prefix}${month}월 ${day}일`
}
