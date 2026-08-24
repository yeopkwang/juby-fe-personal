const EMPTY = '-'

/**
 * 보합(변동 없음)인지. 화면에 찍히는 자릿수로 판단한다.
 * 23만원짜리가 1원 올라 0.0004%가 되면 "+0.00%"로 보이는데 그걸 빨갛게 칠할 이유가 없다.
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
 * 만 단위가 넘으면 축약한다. 그 아래는 자릿수를 살려 0으로 뭉개지지 않게 둔다.
 */
export function formatVolume(volume: number | null): string {
  if (volume === null) return EMPTY
  if (volume < 10_000) return `${volume.toLocaleString('ko-KR')}주`
  return `${Math.round(volume / 10_000).toLocaleString('ko-KR')}만주`
}

/**
 * "2002-05-07" → "2002년 05월 07일"
 *
 * 생년월일은 없을 수 있다. 구글은 기본 스코프에 생일이 없어 실제로 자주 그렇다.
 * 없으면 null을 그대로 돌려주고 그 줄을 어떻게 다룰지는 화면이 정한다.
 */
export function formatBirth(birth: string | null): string | null {
  if (birth === null) return null

  const [year, month, day] = birth.split('-')
  // 서버가 다른 형식을 주기 시작하면 엉뚱한 문자열을 조립하느니 없는 것으로 둔다
  if (year === undefined || month === undefined || day === undefined) return null

  return `${year}년 ${month}월 ${day}일`
}
