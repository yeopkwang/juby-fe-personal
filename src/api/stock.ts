import { get } from './client'
import { fromDashedYmd } from '../utils/date'
import type {
  Candle,
  Period,
  Stock,
  StockDetail,
  StockInfo,
  StockListResponse,
} from '../types/stock'
import type { NewsItem, NewsPage, NewsSort } from '../types/news'

/**
 * 종목 창구. 2026-09-18에 백엔드 `/api/stocks/**`로 갈아탔다.
 *
 * 예전에는 `/api/market/**`가 증권사를 종목마다 한 번씩 중계해서 홈 한 번에 108건이
 * 나갔고, 그걸 버티려고 chunk·retry·캐시·prefetch가 잔뜩 붙어 있었다.
 * 지금은 목록이 DB에서 한 번에 오고, 상세도 일봉은 DB라 그 장치들이 전부 필요 없다.
 * 남은 증권사 호출은 상세의 현재가 한 번뿐이다.
 */

export interface StockList {
  /** YYYYMMDD. 이 날 종가 기준이다 */
  baseDate: string
  stocks: Stock[]
}

/** 100종목 시세. DB만 읽는다 — 증권사 호출이 없어 몇 번을 불러도 부담이 없다 */
export async function getStockList(): Promise<StockList> {
  const response = await get<StockListResponse>('/api/stocks')
  return {
    baseDate: fromDashedYmd(response.baseDate),
    stocks: response.stockList,
  }
}

interface StockDetailResponse {
  stockName: string
  stockCode: string
  currentPrice: number
  comparePrev: number
  period: Period
  dailyPrices: {
    /** YYYY-MM-DD */
    date: string
    openPrice: number
    highPrice: number
    lowPrice: number
    closePrice: number
    volume: number
  }[]
}

/**
 * 종목 상세. 일봉은 DB, **현재가·등락률만 증권사를 한 번 거친다.**
 *
 * 기간을 바꿀 때마다 부르면 그때마다 증권사 호출이 한 번씩 나간다. 상세 화면은
 * ALL로 한 번 받아 두고 기간 탭은 화면에서 잘라 쓴다(StockChartPage 참고).
 * 없는 종목이면 ApiError(404, STOCK404_1)가 난다.
 */
export async function getStockDetail(
  stockCode: string,
  period: Period = 'ALL',
): Promise<StockDetail> {
  const response = await get<StockDetailResponse>(
    `/api/stocks/${encodeURIComponent(stockCode)}?period=${period}`,
  )

  return {
    stockName: response.stockName,
    stockCode: response.stockCode,
    currentPrice: response.currentPrice,
    comparePrev: response.comparePrev,
    period: response.period,
    // 서버가 오름차순으로 주지만 기대지 않는다. 차트는 순서가 어긋나면 그리지 못한다
    candles: response.dailyPrices
      .map(toCandle)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
  }
}

function toCandle(price: StockDetailResponse['dailyPrices'][number]): Candle {
  return {
    date: fromDashedYmd(price.date),
    open: price.openPrice,
    high: price.highPrice,
    low: price.lowPrice,
    close: price.closePrice,
    volume: price.volume,
  }
}

interface StockNewsResponse {
  stockCode: string
  stockName: string
  sort: NewsSort
  newsList: {
    timeAgo: string
    /** "2026-08-19T23:09:00" (시간대 없음, KST) */
    publishedAt: string
    title: string
    description: string
    originalLink: string
  }[]
  page: number
  totalCount: number
}

/** 서버는 page를 0~9로 제한한다(@Max(9)). 그 밖을 보내면 400이다 */
export const NEWS_LAST_PAGE = 9
export const NEWS_PAGE_SIZE = 10

/**
 * 종목 뉴스. Pinecone에 모아 둔 기사라 증권사와 무관하다.
 * 10건씩, 최신순(LATEST)은 발행일 내림차순, 관련도순(RELEVANCE)은 벡터 검색 순서다.
 */
export async function getStockNews(
  stockCode: string,
  sort: NewsSort,
  page: number,
): Promise<NewsPage> {
  const response = await get<StockNewsResponse>(
    `/api/stocks/${encodeURIComponent(stockCode)}/news?sort=${sort}&page=${page}`,
  )

  return {
    items: response.newsList.map(toNewsItem),
    page: response.page,
    totalCount: response.totalCount,
    sort: response.sort,
  }
}

/**
 * 제목·본문에 <b> 태그나 HTML 엔티티가 섞여 올 수 있다(원문이 네이버 검색 결과다).
 * 태그를 지운 뒤 textarea에 넣어 엔티티를 되돌린다. textarea 내용은 HTML로
 * 해석되지 않으므로 무엇이 남아 있어도 실행되지 않는다.
 */
function stripHtml(text: string): string {
  const element = document.createElement('textarea')
  element.innerHTML = text.replace(/<[^>]+>/g, '')
  return element.value
}

/** 언론사명이 응답에 없어 링크 도메인으로 대신한다 */
function toSource(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '')
  } catch {
    return '출처 미상'
  }
}

function toNewsItem(item: StockNewsResponse['newsList'][number]): NewsItem {
  return {
    title: stripHtml(item.title),
    description: stripHtml(item.description),
    link: item.originalLink,
    source: toSource(item.originalLink),
    timeAgo: item.timeAgo,
    publishedAt: new Date(item.publishedAt),
  }
}

/* ── 검색 ─────────────────────────────────────────────────────────────── */

/** 검색창 후보 목록에 한 번에 보여줄 최대 개수 */
const MAX_RESULTS = 8

/** 띄어쓰기와 대소문자를 무시하고 비교하려고 다듬는다. "sk 하이닉스" → "sk하이닉스" */
function normalize(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase()
}

/** 정확히 일치 → 앞부분 일치 → 그 밖의 순서로 보여주기 위한 정렬 키 */
function matchRank(stock: StockInfo, keyword: string): number {
  const name = normalize(stock.stockName)

  if (name === keyword || stock.stockCode === keyword) return 0
  if (name.startsWith(keyword) || stock.stockCode.startsWith(keyword)) return 1
  return 2
}

/**
 * 종목명·종목코드 부분 검색. 백엔드에 검색 API가 없어 넘겨받은 목록에서 찾는다.
 * 목록은 GET /api/stocks 로 받은 것을 쓴다(도착 전에는 stockList.ts의 사본).
 * "삼성"처럼 여러 종목에 걸리는 말은 후보를 전부 돌려주고 고르는 건 화면에 맡긴다.
 *
 * **넘겨주는 목록의 순서가 곧 같은 순위 안의 우선순위다.** 서버 목록은 가나다순이라
 * 그대로 쓰면 "삼성"에 삼성E&A·삼성SDI·…·삼성전기가 앞을 다 차지하고 삼성전자가 잘린다.
 * 부르는 쪽이 거래대금 순으로 세워서 넘기면 사람들이 찾는 종목이 먼저 온다.
 */
export function searchStocks(stocks: StockInfo[], keyword: string): StockInfo[] {
  const normalized = normalize(keyword)
  if (normalized === '') return []

  return stocks
    .filter(
      (stock) =>
        normalize(stock.stockName).includes(normalized) ||
        stock.stockCode.includes(normalized),
    )
    .sort(
      (a, b) =>
        matchRank(a, normalized) - matchRank(b, normalized) ||
        // 같은 순위면 짧은 이름 먼저. "삼성전자"가 "삼성전자우"보다 앞에 온다
        a.stockName.length - b.stockName.length,
    )
    .slice(0, MAX_RESULTS)
}

/** 거래대금 큰 순. 검색 후보와 목록 기본 순서에 쓴다 — 찾는 종목이 위에 오게 */
export function byTradingValue(stocks: Stock[]): Stock[] {
  return [...stocks].sort((a, b) => b.tradingValue - a.tradingValue)
}
