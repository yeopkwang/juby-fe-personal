const EMPTY = '-'

/**
 * 보합(변동 없음)인지. 오름의 빨강도 내림의 파랑도 쓰지 않아야 하는 경우다.
 *
 * 화면에 찍히는 자릿수로 판단한다. 23만원짜리가 1원 올라 0.0004%가 되면
 * "+0.00%"로 보이는데, 눈에 변동이 없는 걸 빨갛게 칠할 이유가 없다.
 * 그래서 소수 자릿수를 formatChangeRate와 똑같이 받는다.
 */
export function isFlatRate(rate: number | null, fractionDigits = 2): boolean {
  if (rate === null) return false
  return Number(rate.toFixed(fractionDigits)) === 0
}

/** 1.01 → "+1.01%", -2.12 → "-2.12%", 0 → "0.00%" */
export function formatChangeRate(rate: number | null, fractionDigits = 2): string {
  if (rate === null) return EMPTY
  // 보합을 그냥 toFixed하면 -0.004가 "-0.00%"가 된다. 부호를 떼고 0으로 적는다
  if (isFlatRate(rate, fractionDigits)) return `${(0).toFixed(fractionDigits)}%`

  const sign = rate > 0 ? '+' : ''
  return `${sign}${rate.toFixed(fractionDigits)}%`
}

/** 181200 → "181,200원" */
export function formatPrice(price: number | null): string {
  if (price === null) return EMPTY
  return `${price.toLocaleString('ko-KR')}원`
}

/**
 * 12345678 → "1,235만주", 5432 → "5,432주"
 *
 * 거래량은 몇천 주에서 수천만 주까지 벌어진다. 원래 숫자를 다 적으면 칸을 넘기므로
 * 만 단위가 넘으면 축약하고, 그 아래는 자릿수를 살려 0으로 뭉개지지 않게 둔다.
 */
export function formatVolume(volume: number | null): string {
  if (volume === null) return EMPTY
  if (volume < 10_000) return `${volume.toLocaleString('ko-KR')}주`
  return `${Math.round(volume / 10_000).toLocaleString('ko-KR')}만주`
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
