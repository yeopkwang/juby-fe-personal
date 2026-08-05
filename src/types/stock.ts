/** 종목 식별 정보. 백엔드 stock 테이블과 같은 형태 */
export interface StockInfo {
  stockCode: string
  stockName: string
}

/** 목록 한 줄. 시세는 아직 안 불러왔거나 조회에 실패하면 null */
export interface Stock extends StockInfo {
  currentPrice: number | null
  /** 등락률(%). 1.01이면 +1.01% */
  changeRate: number | null
  /** 거래대금(원). 화면에는 억 단위로 축약 */
  tradingValue: number | null
  /** 거래대금이 실제값이 아니라 거래량 × 평균가로 계산한 추정치인지 */
  isTradingValueEstimated: boolean
}

/** 종목 하나의 시세 */
export interface Quote {
  currentPrice: number
  changeRate: number
  tradingValue: number | null
  isTradingValueEstimated: boolean
}

export type SortKey =
  | 'stockName'
  | 'currentPrice'
  | 'changeRate'
  | 'tradingValue'

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  key: SortKey
  direction: SortDirection
}

/** 홈 상단 테마별 대표 종목 카드 */
export interface TopStock extends StockInfo {
  /** "기술주 대장" 같은 테마 라벨 */
  theme: string
  /** 90일 전 대비 등락률(%) */
  changeRate: number
  prices: number[]
  /** prices와 같은 길이 */
  volumes: number[]
}
