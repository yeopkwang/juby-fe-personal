import { getRaw } from './client'
import type { Candle, DailyCandleResponse, PriceResponse } from '../types/market'

/*
 * 여기 있던 getDailyCandles(기간 지정 일봉)는 2026-08-19에 지웠다. 모의투자 서버를
 * 거쳐 건당 1.5~2.4초였는데 유일한 사용처인 상세가 백엔드 DB 쪽으로 옮겨 갔다.
 */

/**
 * 실전 서버로 나가는 요청의 제한 시간.
 * 현재가 56ms, 최근 일봉 30~90ms가 실측값이고 밀려도 1초를 안 넘는다.
 * client.ts의 기본값 12초를 쓰면 서버가 멈췄을 때 재시도까지 36초가 걸린다.
 */
const FAST_TIMEOUT = 3_500

/**
 * 최근 30거래일 일봉. 기간을 못 고르는 대신 훨씬 빠르다.
 *
 * 실전 서버라 60ms 안팎이다(지운 기간 지정 일봉은 모의투자 서버라 1.5~2.4초였다).
 * 초당 호출 제한(EGW00201)이 빡빡해 부르는 쪽에서 순차 + withRetry로 감싼다.
 */
export async function getRecentCandles(stockCode: string): Promise<Candle[]> {
  const candles = await getRaw<DailyCandleResponse[]>(
    `/api/market/daily-stock?stockCode=${stockCode}`,
    { timeoutMs: FAST_TIMEOUT },
  )

  return toCandles(candles)
}

/** 백엔드는 최신 날짜부터 내려주므로 뒤집어서 오름차순으로 돌려준다 */
function toCandles(candles: DailyCandleResponse[]): Candle[] {
  return candles
    .map((candle) => ({
      date: candle.stck_bsop_date,
      open: Number(candle.stck_oprc),
      high: Number(candle.stck_hgpr),
      low: Number(candle.stck_lwpr),
      close: Number(candle.stck_clpr),
      volume: Number(candle.acml_vol),
    }))
    .reverse()
}

export function getPrice(stockCode: string): Promise<PriceResponse> {
  return getRaw<PriceResponse>(`/api/market/price?code=${stockCode}`, {
    timeoutMs: FAST_TIMEOUT,
  })
}

/**
 * 등락률(%) 계산. 백엔드가 변동액(prdy_vrss)과 방향(prdy_vrss_sign)만 준다.
 * 변동액에 부호가 있는지 확실치 않아 절댓값에 방향 코드로 부호를 붙인다.
 */
export function toChangeRate(price: PriceResponse): number {
  if (price.prdy_vrss_sign === '3') return 0

  const isDown = price.prdy_vrss_sign === '4' || price.prdy_vrss_sign === '5'
  const diff = Math.abs(Number(price.prdy_vrss)) * (isDown ? -1 : 1)
  const prevClose = Number(price.stck_prpr) - diff

  return prevClose === 0 ? 0 : (diff / prevClose) * 100
}

/**
 * 이 응답에 오늘 정규장 값이 담겼는지. 시가로 판정한다.
 *
 * 08:30~08:40 장전 시간외 물량은 전일 종가로만 거래돼 시가를 만들지 않는다. 그래서
 * 거래량이 잡혀 있어도 시가는 0이고, 시가가 장 시작을 가장 정확히 알려준다.
 * 시각(09:00/15:30)으로 판단하면 휴장·임시휴장·조기폐장에 전부 어긋난다.
 */
export function hasSessionData(price: PriceResponse): boolean {
  return Number(price.stck_oprc) > 0
}

/** 누적 거래량(주). 거래정지 종목은 0이 오는데 "0주"로 적히지 않게 없는 값으로 둔다 */
export function toVolume(price: PriceResponse): number | null {
  const volume = Number(price.acml_vol)
  return volume > 0 ? volume : null
}
