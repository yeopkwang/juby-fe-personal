import type { SortKey, SortState, Stock } from '../types/stock'

/** 정렬된 새 배열을 돌려준다. 원본은 건드리지 않는다 */
export function sortStocks(stocks: Stock[], sort: SortState): Stock[] {
  const sign = sort.direction === 'asc' ? 1 : -1

  return [...stocks].sort((a, b) => {
    if (sort.key === 'stockName') {
      return a.stockName.localeCompare(b.stockName, 'ko') * sign
    }
    return (a[sort.key] - b[sort.key]) * sign
  })
}

/** 다른 컬럼을 누르면 기본 방향으로, 같은 컬럼을 다시 누르면 반대 방향으로 */
export function nextSort(current: SortState | null, key: SortKey): SortState {
  if (current !== null && current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  }

  return { key, direction: key === 'stockName' ? 'asc' : 'desc' }
}
