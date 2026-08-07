import { getRaw } from './client'
import type { Candle, DailyCandleResponse, PriceResponse } from '../types/market'

/**
 * 일봉 조회. 백엔드는 최신 날짜부터 내려주므로 뒤집어서 오름차순으로 돌려준다.
 * @param startDate YYYYMMDD
 * @param endDate   YYYYMMDD
 */
export async function getDailyCandles(
  stockCode: string,
  startDate: string,
  endDate: string,
): Promise<Candle[]> {
  const candles = await getRaw<DailyCandleResponse[]>(
    `/api/market/daily_itemchartprice?stockcode=${stockCode}&startdate=${startDate}&enddate=${endDate}`,
  )

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
  return getRaw<PriceResponse>(`/api/market/price?code=${stockCode}`)
}

/**
 * 등락률(%) 계산.
 * 백엔드가 등락률을 안 주고 변동액(prdy_vrss)과 방향(prdy_vrss_sign)만 준다.
 * 변동액에 부호가 있는지 확실치 않아 절댓값을 쓰고 방향 코드로 부호를 붙인다.
 */
export function toChangeRate(price: PriceResponse): number {
  if (price.prdy_vrss_sign === '3') return 0

  const isDown = price.prdy_vrss_sign === '4' || price.prdy_vrss_sign === '5'
  const diff = Math.abs(Number(price.prdy_vrss)) * (isDown ? -1 : 1)
  const prevClose = Number(price.stck_prpr) - diff

  return prevClose === 0 ? 0 : (diff / prevClose) * 100
}

/**
 * 이 응답에 오늘 정규장 값이 담겼는지.
 *
 * 정규장이 열리면 첫 체결로 시가가 정해진다. 그 전까지는 시가가 0으로 온다.
 * 08:30~08:40 장전 시간외에 체결된 물량은 전일 종가로만 거래되어 시가를 만들지 않으므로,
 * 시간외 거래량이 잡혀 있어도 시가는 여전히 0이다. 그래서 시가가 장 시작 여부를 가장 정확히 알려준다.
 *
 * 시각(09:00/15:30)으로 판단하지 않는 이유는 휴장일, 임시휴장, 조기폐장에 전부 어긋나기 때문이다.
 */
export function hasSessionData(price: PriceResponse): boolean {
  return Number(price.stck_oprc) > 0
}

/**
 * 누적 거래량(주).
 *
 * 거래정지 종목은 0이 온다. "0주"라고 적으면 거래가 없었다는 뜻으로 읽히므로
 * 값이 없는 것으로 보고 "-"로 둔다.
 */
export function toVolume(price: PriceResponse): number | null {
  const volume = Number(price.acml_vol)
  return volume > 0 ? volume : null
}
