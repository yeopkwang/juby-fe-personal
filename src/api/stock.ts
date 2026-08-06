import type { StockInfo } from '../types/stock'
import { STOCK_LIST } from './stockList'

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
