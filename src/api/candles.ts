import { getDailyCandles, getRecentCandles } from './market'
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

/**
 * 아직 안 끝난 오늘 봉을 잘라낸다.
 *
 * 증권사가 주는 가장 최근 봉은 장이 닫히기 전까지 확정된 종가가 아니라 그 순간의 현재가다.
 * 그대로 쓰면 새로고침할 때마다 차트 끝과 등락률이 움직인다.
 * 백엔드 daily_price 테이블에도 장 마감 후에 확정값만 들어가므로, 오늘을 빼면 그쪽과 같아진다.
 *
 * 날짜가 YYYYMMDD 문자열이라 사전순 비교가 곧 날짜순 비교다.
 */
function dropUnsettled(candles: Candle[]): Candle[] {
  const today = toYmd(new Date())
  const settled = candles.filter((candle) => candle.date < today)
  // 오늘 것밖에 없는 종목이면 빈 차트를 보여주느니 그거라도 그린다
  return settled.length > 0 ? settled : candles
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
    .then((raw) => {
      const candles = dropUnsettled(raw)
      if (candles.length > 0) writeCache(cacheKey(stockCode), candles)
      return candles
    })
    .finally(() => inFlight.delete(stockCode))

  inFlight.set(stockCode, request)
  return request
}

/**
 * 최근 30거래일(약 6주)만 받는 빠른 길.
 *
 * 위 loadCandles는 1년치를 받으려고 모의투자 서버를 거쳐 건당 1.5~2.4초가 걸린다.
 * 홈 카드는 최근 흐름만 그리면 되므로 실전 서버 쪽(60ms)으로 받는다.
 *
 * 초당 호출 제한(EGW00201)에 걸리면 500이 오는데, 잠깐 쉬었다 부르면 대개 통과한다.
 * 상세 화면 캐시와는 담는 내용이 달라(구간이 짧다) 섞이지 않게 저장하지 않는다.
 * 카드 자체는 home.ts의 topStocks 캐시가 따로 들고 있다.
 */
export function loadRecentCandles(stockCode: string): Promise<Candle[]> {
  return withRetry(() => getRecentCandles(stockCode), 2, 400).then(dropUnsettled)
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
