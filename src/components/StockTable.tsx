import { Link } from 'react-router-dom'
import type { MouseEvent } from 'react'
import Skeleton from './Skeleton'
import type { SortDirection, SortKey, SortState, Stock } from '../types/stock'
import {
  formatChangeRate,
  formatPrice,
  formatVolume,
  isFlatRate,
} from '../utils/format'
import styles from './StockTable.module.css'

interface Props {
  stocks: Stock[]
  sort: SortState | null
  onSort: (key: SortKey) => void
  isSortDisabled: boolean
  favoriteCodes: Set<string>
  onHeartClick: (stockCode: string) => void
  /**
   * 시세가 아직 오는 중인가.
   *
   * 이게 없을 때는 **빈 값과 오는 중인 값이 화면에서 똑같았다.** 둘 다 "-"였다.
   * 102종목 시세는 다 차는 데 몇 초가 걸리는데, 그동안 표는 거래정지 종목만
   * 잔뜩 있는 것처럼 보였다. 기다리면 되는 건지 고장인 건지 알 방법이 없었다.
   */
  isQuoteLoading: boolean
}

/**
 * isNumeric인 칸은 자릿수를 견주기 쉽도록 오른쪽에 붙인다.
 * hideAt은 화면이 좁아질 때 가장 먼저 접을 칸을 정한다(거래량 → 종목코드 순).
 */
const SORTABLE_COLUMNS: {
  key: SortKey
  label: string
  isNumeric: boolean
  hideAt?: 'small'
}[] = [
  { key: 'stockName', label: '종목명', isNumeric: false },
  { key: 'currentPrice', label: '현재가', isNumeric: true },
  { key: 'changeRate', label: '등락률', isNumeric: true },
  { key: 'volume', label: '거래량', isNumeric: true, hideAt: 'small' },
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

/**
 * 값이 없는 칸에 무엇을 그릴지 고른다.
 *
 * 오는 중이면 회색 판, 다 받고도 없으면 "-". **"-"는 "없다"는 뜻으로만 쓴다.**
 * (거래정지 종목처럼 실제로 값이 없는 경우가 있어서 "-" 자체는 필요하다.)
 */
function Cell({
  value,
  text,
  isLoading,
}: {
  value: number | null
  text: string
  isLoading: boolean
}) {
  if (value === null && isLoading) {
    return <Skeleton className={styles.cellSkeleton} />
  }
  return <>{text}</>
}

function rateClassName(rate: number | null): string {
  if (rate === null) return styles.numeric
  if (isFlatRate(rate)) return `${styles.numeric} ${styles.flat}`
  return `${styles.numeric} ${rate > 0 ? styles.up : styles.down}`
}

export default function StockTable({
  stocks,
  sort,
  onSort,
  isSortDisabled,
  favoriteCodes,
  onHeartClick,
  isQuoteLoading,
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
        <span className={styles.colCode}>번호</span>

        {SORTABLE_COLUMNS.map((column) => {
          const direction =
            sort !== null && sort.key === column.key ? sort.direction : null

          const classNames = [styles.sortButton]
          if (direction !== null) classNames.push(styles.sortButtonActive)
          if (column.isNumeric) classNames.push(styles.numericHead)
          if (column.hideAt === 'small') classNames.push(styles.colVolume)

          return (
            <button
              key={column.key}
              type="button"
              className={classNames.join(' ')}
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

      <ul className={styles.body}>
        {stocks.map((stock) => {
          const isFavorite = favoriteCodes.has(stock.stockCode)

          return (
            <li key={stock.stockCode} className={styles.row}>
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

              <span className={`${styles.code} ${styles.colCode}`}>
                {stock.stockCode}
              </span>

              {/*
                링크는 종목명 하나뿐이고, 그 링크가 ::after로 행 전체를 덮어 어디를 눌러도 이동한다.
                예전에는 행 전체가 <a>고 그 안에 하트 <button>이 있었는데,
                HTML은 <a> 안에 버튼 같은 조작 요소를 넣는 것을 허용하지 않는다.
                하트는 z-index로 덮개 위에 띄워 두어 따로 눌린다.
              */}
              <span className={styles.name}>
                <Link to={`/stocks/${stock.stockCode}`} className={styles.nameLink}>
                  {stock.stockName}
                </Link>
              </span>

              <span className={styles.numeric}>
                <Cell
                  value={stock.currentPrice}
                  text={formatPrice(stock.currentPrice)}
                  isLoading={isQuoteLoading}
                />
              </span>
              <span className={rateClassName(stock.changeRate)}>
                <Cell
                  value={stock.changeRate}
                  text={formatChangeRate(stock.changeRate)}
                  isLoading={isQuoteLoading}
                />
              </span>
              <span className={`${styles.numeric} ${styles.colVolume}`}>
                <Cell
                  value={stock.volume}
                  text={formatVolume(stock.volume)}
                  isLoading={isQuoteLoading}
                />
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
