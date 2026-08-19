import { get } from './client'
import { STOCK_LIST } from './stockList'
import type {
  NewsSort,
  StockDetail,
  StockInfo,
  StockNews,
  StockPeriod,
} from '../types/stock'

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
 * 종목명·종목코드 부분 검색. 백엔드에 검색 API가 없어 목록에서 찾는다.
 * "삼성"처럼 여러 종목에 걸리는 말은 후보를 전부 돌려주고 고르는 건 화면에 맡긴다.
 * API가 나오면 이 함수 안만 fetch로 교체한다.
 */
export async function searchStocks(keyword: string): Promise<StockInfo[]> {
  const normalized = normalize(keyword)
  if (normalized === '') return []

  return STOCK_LIST.filter(
    (stock) =>
      normalize(stock.stockName).includes(normalized) ||
      stock.stockCode.includes(normalized),
  )
    .sort((a, b) => matchRank(a, normalized) - matchRank(b, normalized))
    .slice(0, MAX_RESULTS)
}

/** 종목코드로 이름을 찾는다. 상세 화면이 주소만 받아서 들어오기 때문에 필요하다 */
export function findStock(stockCode: string): StockInfo | null {
  return STOCK_LIST.find((stock) => stock.stockCode === stockCode) ?? null
}

/* ────────────────────────────────────────────────────────────────
 * 종목 상세 페이지 (2026-08-19 연결)
 *
 * 이 두 창구가 생기기 전에는 상세 화면이 증권사(KIS) 중계를 **두 번** 썼다 —
 * 현재가 `/api/market/price`와 일봉 `/api/market/daily_itemchartprice`. 그중 일봉은
 * 모의투자 서버를 거쳐 건당 1.5~2.4초가 걸려서, 캐시(`api/candles.ts`)와 미리받기로
 * 겨우 버티고 있었다.
 *
 * 지금은 일봉이 백엔드 **DB(daily_price)** 에서 오고 KIS는 현재가 1건만 남는다.
 * 뉴스는 Pinecone(벡터DB)이라 KIS를 아예 거치지 않는다.
 * ──────────────────────────────────────────────────────────────── */

/**
 * 종목 상세. 기간의 OHLCV + 현재가 + 전일 대비.
 *
 * `period`를 안 보내면 백엔드 기본값이 `ALL`(2025-01-02부터)이라 400건 가까이 온다.
 * 화면이 쓰는 기간을 반드시 명시한다.
 *
 * 없는 종목코드면 `STOCK_NOT_FOUND`로 실패한다(`client.ts`가 message를 던진다).
 */
export function getStockDetail(
  stockCode: string,
  period: StockPeriod,
): Promise<StockDetail> {
  return get<StockDetail>(
    `/api/stocks/${encodeURIComponent(stockCode)}?period=${period}`,
  )
}

/**
 * 종목 관련 뉴스.
 *
 * **정렬은 백엔드가 한다.** 화면에서 다시 줄 세우지 않는다 — `RELEVANCE`는 벡터 유사도라
 * 프론트가 흉내 낼 수 있는 값이 아니고, `LATEST`도 서버가 발행일 내림차순으로 이미 맞춰 준다.
 *
 * 후보 100건을 10건씩 잘라 주므로 `page`는 **0~9**다. 범위를 넘기면 400이 온다
 * (백엔드 `StockNewsReq`에 `@Min(0) @Max(9)`).
 */
export function getStockNews(
  stockCode: string,
  sort: NewsSort,
  page: number,
): Promise<StockNews> {
  return get<StockNews>(
    `/api/stocks/${encodeURIComponent(stockCode)}/news?sort=${sort}&page=${page}`,
  )
}
