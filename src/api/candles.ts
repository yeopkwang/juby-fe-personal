import { getDailyCandles } from './market'
import { daysAgo, toYmd } from '../utils/date'
import { withRetry } from '../utils/async'
import { readCache, writeCache } from '../utils/cache'
import type { Candle } from '../types/market'

/**
 * 상세 화면 일봉을 받아오는 창구.
 *
 * 백엔드는 이 요청만 한국투자증권 **모의투자** 서버로 중계하는데 건당 1.5~2.4초가 걸린다.
 * (같은 백엔드의 현재가는 실전 서버라 56ms다.) 백엔드에 daily_price 테이블과 기간 조회
 * 메서드가 이미 있으니 그걸 읽는 API가 생기면 아래 지연은 사라지고 캐시도 필요 없어진다.
 *
 * 그때까지는 두 가지로 버틴다. 한 번 받은 건 저장해 두고, 누를 것 같으면 미리 받아 둔다.
 */

/** 1년치를 달라고 해도 증권사가 100건까지만 준다. 화면은 최근 30일만 보여주고 나머지는 밀어서 본다 */
const CHART_DAYS = 365

const CACHE_MAX_AGE = 12 * 60 * 60 * 1000

function cacheKey(stockCode: string): string {
  return `candles:${stockCode}`
}

/** 지난번에 받아둔 일봉. 첫 그림을 즉시 그리는 용도다 */
export function readCachedCandles(stockCode: string): Candle[] | null {
  const cached = readCache<Candle[]>(cacheKey(stockCode), CACHE_MAX_AGE)
  return cached === null || cached.length === 0 ? null : cached
}

/**
 * 같은 종목을 동시에 두 번 부르지 않게 진행 중인 요청을 붙잡아 둔다.
 * 미리 받기와 화면 진입이 겹치면 같은 요청이 두 번 나가는데, 하필 호출 제한이 빡빡한 API다.
 */
const inFlight = new Map<string, Promise<Candle[]>>()

export function loadCandles(stockCode: string): Promise<Candle[]> {
  const ongoing = inFlight.get(stockCode)
  if (ongoing !== undefined) return ongoing

  const request = withRetry(
    () => getDailyCandles(stockCode, toYmd(daysAgo(CHART_DAYS)), toYmd(new Date())),
    2,
    1000,
  )
    .then((candles) => {
      if (candles.length > 0) writeCache(cacheKey(stockCode), candles)
      return candles
    })
    .finally(() => inFlight.delete(stockCode))

  inFlight.set(stockCode, request)
  return request
}

/**
 * 누르기 전에 미리 받아 둔다. 목록에서 마우스를 올린 순간부터 클릭까지의 시간을 벌어
 * 상세 화면에 도착했을 때는 이미 받아둔 값으로 바로 그릴 수 있다.
 */
export function prefetchCandles(stockCode: string): void {
  if (readCachedCandles(stockCode) !== null) return

  void loadCandles(stockCode).catch(() => {
    // 미리 받아두려던 것뿐이다. 실패해도 상세 화면에 들어가면 다시 부른다
  })
}
