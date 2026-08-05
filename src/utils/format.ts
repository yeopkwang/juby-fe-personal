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
