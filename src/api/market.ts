import { getRaw } from './client'
import type {
  DailyCandleResponse,
  DailyPoint,
  PriceResponse,
  VolumeRankResponse,
} from '../types/market'

/**
 * 일봉 조회. 백엔드는 최신 날짜부터 내려주므로 뒤집어서 오름차순으로 돌려준다.
 * @param startDate YYYYMMDD
 * @param endDate   YYYYMMDD
 */
export async function getDailyChart(
  stockCode: string,
  startDate: string,
  endDate: string,
): Promise<DailyPoint[]> {
  const candles = await getRaw<DailyCandleResponse[]>(
    `/api/market/daily_itemchartprice?stockcode=${stockCode}&startdate=${startDate}&enddate=${endDate}`,
  )

  return candles
    .map((candle) => ({
      date: candle.stck_bsop_date,
      close: Number(candle.stck_clpr),
      volume: Number(candle.acml_vol),
    }))
    .reverse()
}

export function getPrice(stockCode: string): Promise<PriceResponse> {
  return getRaw<PriceResponse>(`/api/market/price?code=${stockCode}`)
}

/** 거래량 상위 30종목. 현재 화면에서는 거래대금을 얻는 용도로만 쓴다 */
export function getVolumeRank(): Promise<VolumeRankResponse[]> {
  return getRaw<VolumeRankResponse[]>('/api/market/volume-rank')
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
 * 거래대금(원) 추정치.
 * 백엔드 현재가 응답에 거래대금 필드가 없어 `거래량 × 평균단가`로 계산한다.
 * 평균단가는 (고가+저가+현재가)/3.
 * 거래대금 상위 17종목의 실제값과 비교했을 때 평균 오차 0.39%, 최대 2.60%.
 */
export function toTradingValue(price: PriceResponse): number | null {
  const volume = Number(price.acml_vol)
  // 거래정지 종목은 현재가만 오고 나머지가 0이다. 0억원으로 보이면 오해를 부르니 "-"로 둔다
  if (volume === 0) return null

  const high = Number(price.stck_hgpr)
  const low = Number(price.stck_lwpr)
  const current = Number(price.stck_prpr)

  return volume * ((high + low + current) / 3)
}
