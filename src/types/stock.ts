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
  /**
   * 누적 거래량(주). 화면에는 만 단위로 축약한다.
   * 백엔드 daily_price 테이블에도 같은 이름의 컬럼이 있어, DB 조회 API가 생기면 그대로 받는다.
   */
  volume: number | null
}

/** 종목 하나의 시세 */
export interface Quote {
  currentPrice: number
  changeRate: number
  volume: number | null
}

export type SortKey =
  | 'stockName'
  | 'currentPrice'
  | 'changeRate'
  | 'volume'

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  key: SortKey
  direction: SortDirection
}

/** 카드 제목에 필요한 부분. 그래프가 도착하기 전에 이것만으로 먼저 그린다 */
export type TopTheme = Pick<TopStock, 'stockCode' | 'stockName' | 'theme'>

/** 홈 상단 테마별 대표 종목 카드 */
export interface TopStock extends StockInfo {
  /** "기술주 대장" 같은 테마 라벨 */
  theme: string
  /** 받아온 구간(최근 30거래일 ≈ 6주) 처음 대비 등락률(%) */
  changeRate: number
  prices: number[]
  /** prices와 같은 길이 */
  volumes: number[]
}
