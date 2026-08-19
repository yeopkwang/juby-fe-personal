/** 백엔드가 한국투자증권 응답을 그대로 중계한다. 숫자가 전부 문자열로 온다 */
export interface DailyCandleResponse {
  /** YYYYMMDD */
  stck_bsop_date: string
  /** 종가 */
  stck_clpr: string
  /** 시가 */
  stck_oprc: string
  /** 고가 */
  stck_hgpr: string
  /** 저가 */
  stck_lwpr: string
  /** 누적 거래량 */
  acml_vol: string
}

/** 화면에서 쓰기 좋게 변환한 일봉 한 개 */
export interface Candle {
  /** YYYYMMDD */
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** 현재가 조회 응답 */
export interface PriceResponse {
  /** 현재가 */
  stck_prpr: string
  stck_oprc: string
  stck_hgpr: string
  stck_lwpr: string
  acml_vol: string
  /** 전일 대비 변동액(부호 없음) */
  prdy_vrss: string
  /** 1 상한 2 상승 3 보합 4 하한 5 하락 */
  prdy_vrss_sign: string
}
