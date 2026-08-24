import { readCache, writeCache } from '../utils/cache'
import type { Quote } from '../types/stock'

/**
 * 마지막 정규장 시세를 붙들어 두는 곳.
 *
 * 현재가 API는 "오늘 장" 기준이라 장이 없는 동안 등락률과 거래량이 0으로 온다.
 * 그대로 두면 밤이나 주말에 표 전체가 0.00% / "-"가 되어 비어 보인다. 그래서
 * 정규장 값을 저장해 두고 장이 없는 동안 그 값을 보여준다.
 */

const SNAPSHOT_KEY = 'quoteSnapshot'

/** 연휴가 길어도 직전 장 값은 남아 있도록 넉넉히 잡는다. 화면에는 언제 기준인지 함께 적는다 */
const MAX_AGE = 7 * 24 * 60 * 60 * 1000

export interface QuoteSnapshot {
  /** 이 시세가 어느 날 정규장 것인지. YYYYMMDD */
  date: string
  quotes: Record<string, Quote>
}

export function readQuoteSnapshot(): QuoteSnapshot | null {
  const snapshot = readCache<QuoteSnapshot>(SNAPSHOT_KEY, MAX_AGE)
  return snapshot === null || Object.keys(snapshot.quotes).length === 0
    ? null
    : snapshot
}

/**
 * 받아온 정규장 시세를 저장한다. 부르는 쪽이 나눠서 받으므로 여러 번에 걸쳐 들어온다.
 * 같은 날짜면 앞서 저장한 것 위에 얹고, 날짜가 바뀌었으면 지난 장 값은 버린다.
 */
export function saveQuoteSnapshot(date: string, quotes: Map<string, Quote>): void {
  if (quotes.size === 0) return

  const previous = readQuoteSnapshot()
  const merged =
    previous !== null && previous.date === date ? { ...previous.quotes } : {}

  quotes.forEach((quote, stockCode) => {
    merged[stockCode] = quote
  })

  writeCache<QuoteSnapshot>(SNAPSHOT_KEY, { date, quotes: merged })
}
