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

/* ────────────────────────────────────────────────────────────────
 * 종목 상세 페이지 — GET /api/stocks/{stockCode}, /{stockCode}/news
 * ──────────────────────────────────────────────────────────────── */

/**
 * 상세 조회 기간.
 *
 * ⚠️ **백테스트의 `BacktestPeriod`와 값이 다르다.** 이쪽은 **단수**(`THREE_MONTH`),
 * 백테스트는 **복수**(`THREE_MONTHS`)다. 같은 백엔드인데 enum이 둘로 갈려 있으니
 * 복사해 쓰지 말 것 — 섞으면 400이 온다.
 * 근거: 백엔드 `domain/stock/enums/Period.java`.
 */
export type StockPeriod =
  | 'ONE_WEEK'
  | 'ONE_MONTH'
  | 'THREE_MONTH'
  | 'SIX_MONTH'
  | 'ONE_YEAR'
  | 'THREE_YEAR'
  | 'ALL'

/** 일봉 한 개. 백엔드 daily_price 테이블을 그대로 옮긴 것이라 증권사 약어가 아니다 */
export interface DailyPrice {
  /** "2026-08-18" — 백엔드가 LocalDate라 하이픈이 있다. Candle.date(YYYYMMDD)와 다르다 */
  date: string
  openPrice: number
  highPrice: number
  lowPrice: number
  closePrice: number
  volume: number
}

/**
 * 상세 조회 응답.
 *
 * `dailyPrices`는 백엔드 **DB**에서 오고(증권사 아님), `currentPrice`·`comparePrev` 두 개만
 * KIS를 거친다. 그래서 종목 하나당 증권사 호출은 **1건**이다.
 *
 * ⚠️ **장 시작 전에는 `comparePrev`가 0.0으로 온다**(그때 `currentPrice`는 전일 종가와 같다).
 * 증권사 현재가가 "오늘 장" 기준이라 그렇다. 홈은 quoteSnapshot으로 이미 다루지만
 * 상세는 아직 그대로다.
 */
export interface StockDetail {
  stockName: string
  stockCode: string
  currentPrice: number
  /** 전일 대비 등락률(%). 1.01이면 +1.01% */
  comparePrev: number
  period: StockPeriod
  /** 날짜 오름차순. 확정된 봉만 담기므로 오늘 것은 들어 있지 않다 */
  dailyPrices: DailyPrice[]
}

/** 뉴스 정렬. 백엔드 `domain/news/enums/NewsSortType.java` */
export type NewsSort = 'LATEST' | 'RELEVANCE'

/** 뉴스 한 건. Pinecone(벡터DB)에 적재된 기사다 */
export interface StockNewsItem {
  /** "2시간 전" — 백엔드가 계산해서 준다 */
  timeAgo: string
  /** "2026-08-19T05:50:00" — 시간대 표기가 없다(서버 기준 KST) */
  publishedAt: string
  title: string
  description: string
  originalLink: string
}

/** 뉴스 조회 응답. 후보 100건을 10건씩 잘라 준다 */
export interface StockNews {
  stockCode: string
  stockName: string
  sort: NewsSort
  newsList: StockNewsItem[]
  page: number
  /** 잘라내기 전 후보 전체 개수. "더 보기"를 더 눌러도 되는지 이것으로 판단한다 */
  totalCount: number
}
