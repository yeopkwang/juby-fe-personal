import { FAST_TIMEOUT, get } from './client'
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
 */
export async function searchStocks(keyword: string): Promise<StockInfo[]> {
  const normalized = normalize(keyword)
  if (!normalized) return []

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

/*
 * 종목 상세 페이지 (2026-08-19 연결).
 *
 * 예전에는 상세가 KIS 중계를 두 번 썼다 — 현재가와 일봉. 일봉은 모의투자 서버라
 * 건당 1.5~2.4초여서 캐시와 미리받기로 버텼다. 지금은 일봉이 백엔드 DB에서 오고
 * KIS는 현재가 1건만 남는다. 뉴스는 Pinecone이라 KIS를 아예 거치지 않는다.
 */

/**
 * 상세 화면이 받아 가는 기간.
 *
 * 화면 파일이 아니라 여기 있는 이유: 상세 요청을 **화면보다 먼저** 시작하는 자리가
 * 있다(`api/warmup.ts`). 그쪽이 같은 기간으로 불러야 화면이 그 결과를 그대로 받아 쓴다.
 * 값이 갈리면 미리 부른 것이 버려지고 조용히 두 번 부르게 되는데, 이 창구는 백엔드에서
 * KIS를 1건 부르므로 그 낭비가 곧 KIS 호출 2건이다.
 *
 * ⚠️ 바꾸기 전에 `StockPeriod`의 주석을 읽는다. 백테스트 쪽과 열거값이 갈려 있어
 * 복사해 쓰면 400이 온다(단수 `THREE_MONTH` vs 복수 `THREE_MONTHS`).
 */
export const DETAIL_PERIOD: StockPeriod = 'ALL'

/**
 * 종목 상세. 기간의 OHLCV + 현재가 + 전일 대비.
 * period를 안 보내면 기본값이 ALL(2025-01-02부터)이라 400건 가까이 온다. 반드시 명시한다.
 * 없는 종목코드면 STOCK_NOT_FOUND로 실패한다.
 */
export function getStockDetail(
  stockCode: string,
  period: StockPeriod,
): Promise<StockDetail> {
  return get<StockDetail>(
    `/api/stocks/${encodeURIComponent(stockCode)}?period=${period}`,
    /* 38~86ms로 재봤다. 아래 뉴스는 창구가 달라 같이 묶지 않는다 */
    { timeoutMs: FAST_TIMEOUT },
  )
}

/**
 * 종목 관련 뉴스.
 *
 * 정렬은 백엔드가 한다. RELEVANCE는 벡터 유사도라 프론트가 흉내 낼 수 없다.
 * 후보 100건을 10건씩 잘라 주므로 page는 0~9다. 넘기면 400이 온다(@Min(0) @Max(9)).
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
