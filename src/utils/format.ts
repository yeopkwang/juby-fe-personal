const EMPTY = '-'

/** 1.01 → "+1.01%", -2.12 → "-2.12%" */
export function formatChangeRate(rate: number | null, fractionDigits = 2): string {
  if (rate === null) return EMPTY
  const sign = rate > 0 ? '+' : ''
  return `${sign}${rate.toFixed(fractionDigits)}%`
}

/** 181200 → "181,200원" */
export function formatPrice(price: number | null): string {
  if (price === null) return EMPTY
  return `${price.toLocaleString('ko-KR')}원`
}

/** 635800000000 → "6,358억원" */
export function formatTradingValue(value: number | null): string {
  if (value === null) return EMPTY
  return `${Math.round(value / 100_000_000).toLocaleString('ko-KR')}억원`
}

/** 뉴스 발행 시각. 하루가 넘으면 "8월 5일"처럼 날짜로 보여준다 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000)

  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`

  return `${date.getMonth() + 1}월 ${date.getDate()}일`
}
