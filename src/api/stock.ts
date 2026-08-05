import type { StockInfo } from '../types/stock'
import { STOCK_LIST } from './stockList'

/**
 * 종목명 검색. 백엔드에 검색 API가 없어 목록에서 찾는다.
 * "삼성"이 삼성전자·삼성바이오로직스에 모두 걸리므로 정확히 일치할 때만 반환한다.
 * API가 나오면 이 함수 안만 fetch로 교체한다.
 */
export async function searchStock(keyword: string): Promise<StockInfo | null> {
  const found = STOCK_LIST.find((stock) => stock.stockName === keyword)
  return found ?? null
}
