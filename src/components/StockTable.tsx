import { Link } from 'react-router-dom'
import type { MouseEvent } from 'react'
import type { SortDirection, SortKey, SortState, Stock } from '../types/stock'
import {
  formatChangeRate,
  formatPrice,
  formatTradingValue,
} from '../utils/format'
import styles from './StockTable.module.css'

interface Props {
  stocks: Stock[]
  sort: SortState | null
  onSort: (key: SortKey) => void
  isSortDisabled: boolean
  favoriteCodes: Set<string>
  onHeartClick: (stockCode: string) => void
}

const SORTABLE_COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'stockName', label: '종목명' },
  { key: 'currentPrice', label: '현재가' },
  { key: 'changeRate', label: '등락률' },
  { key: 'tradingValue', label: '거래대금' },
]

function SortIcon({ direction }: { direction: SortDirection | null }) {
  const className =
    direction === 'asc' ? `${styles.sortIcon} ${styles.sortIconUp}` : styles.sortIcon

  return (
    <svg className={className} width="10" height="10" viewBox="0 0 10 10">
      <path d="M2 4L5 7L8 4" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function rateClassName(rate: number | null): string | undefined {
  if (rate === null) return undefined
  return rate >= 0 ? styles.up : styles.down
}

export default function StockTable({
  stocks,
  sort,
  onSort,
  isSortDisabled,
  favoriteCodes,
  onHeartClick,
}: Props) {
  function handleHeartClick(
    event: MouseEvent<HTMLButtonElement>,
    stockCode: string,
  ) {
    // 하트는 행 이동과 별개로 동작해야 한다
    event.preventDefault()
    event.stopPropagation()
    onHeartClick(stockCode)
  }

  return (
    <div className={styles.table}>
      <div className={styles.head}>
        <span />
        <span>번호</span>

        {SORTABLE_COLUMNS.map((column) => {
          const direction =
            sort !== null && sort.key === column.key ? sort.direction : null

          return (
            <button
              key={column.key}
              type="button"
              className={
                direction === null
                  ? styles.sortButton
                  : `${styles.sortButton} ${styles.sortButtonActive}`
              }
              onClick={() => onSort(column.key)}
              disabled={isSortDisabled}
              aria-label={`${column.label} 기준 정렬`}
            >
              {column.label}
              <SortIcon direction={direction} />
            </button>
          )
        })}
      </div>

      {stocks.map((stock) => {
        const isFavorite = favoriteCodes.has(stock.stockCode)

        return (
          <Link
            key={stock.stockCode}
            to={`/stocks/${stock.stockCode}`}
            className={styles.row}
          >
            <button
              type="button"
              className={
                isFavorite ? `${styles.heart} ${styles.heartOn}` : styles.heart
              }
              onClick={(event) => handleHeartClick(event, stock.stockCode)}
              aria-pressed={isFavorite}
              aria-label={`${stock.stockName} 관심종목 ${isFavorite ? '해제' : '추가'}`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={isFavorite ? 'currentColor' : 'none'}
              >
                <path
                  d="M12 20.3 4.1 12.4a4.9 4.9 0 0 1 6.9-6.9l1 1 1-1a4.9 4.9 0 0 1 6.9 6.9z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <span className={styles.code}>{stock.stockCode}</span>
            <span className={styles.name}>{stock.stockName}</span>
            <span>{formatPrice(stock.currentPrice)}</span>
            <span className={rateClassName(stock.changeRate)}>
              {formatChangeRate(stock.changeRate)}
            </span>
            <span
              title={
                stock.isTradingValueEstimated
                  ? '거래량 × 평균가로 계산한 추정치입니다'
                  : undefined
              }
            >
              {formatTradingValue(stock.tradingValue)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
