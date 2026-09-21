import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLikeStocks, unlikeStock } from '../api/member'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { fromDashedYmd, toKoreanDate } from '../utils/date'
import {
  formatChangeRate,
  formatPrice,
  formatTradingValue,
  isFlatRate,
} from '../utils/format'
import type { LikeStock } from '../types/member'
import styles from './MypageLikesPage.module.css'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; baseDate: string; stocks: LikeStock[] }
  | { kind: 'error' }

function rateClassName(rate: number): string {
  if (isFlatRate(rate)) return `${styles.numeric} ${styles.flat}`
  return `${styles.numeric} ${rate > 0 ? styles.up : styles.down}`
}

/** 홈에서 하트를 누른 종목들. 시세는 홈 표와 같은 기준일 종가다 */
export default function MypageLikesPage() {
  useDocumentTitle('관심종목')
  const [state, setState] = useState<State>({ kind: 'loading' })
  /** 해제 요청이 진행 중인 종목. 연타를 막는다 */
  const pending = useRef(new Set<string>())

  const load = useCallback(() => {
    setState({ kind: 'loading' })

    getLikeStocks()
      .then((result) =>
        setState({
          kind: 'ready',
          baseDate: fromDashedYmd(result.baseDate),
          stocks: result.likeStockList,
        }),
      )
      .catch((error: unknown) => {
        console.warn('관심종목 조회 실패', error)
        setState({ kind: 'error' })
      })
  }, [])

  useEffect(load, [load])

  /** 먼저 지우고 서버에 알린다. 실패하면 목록을 다시 받아 원래대로 돌린다 */
  async function handleUnlike(stockCode: string) {
    if (pending.current.has(stockCode)) return
    pending.current.add(stockCode)

    setState((current) =>
      current.kind === 'ready'
        ? {
            ...current,
            stocks: current.stocks.filter((s) => s.stockCode !== stockCode),
          }
        : current,
    )

    try {
      await unlikeStock(stockCode)
    } catch (error: unknown) {
      console.warn('관심종목 해제 실패', error)
      load()
    } finally {
      pending.current.delete(stockCode)
    }
  }

  if (state.kind === 'loading') {
    return <div className={styles.skeleton} aria-label="불러오는 중" />
  }

  if (state.kind === 'error') {
    return (
      <div className={styles.message}>
        <p className={styles.messageText}>관심종목을 불러오지 못했습니다.</p>
        <button type="button" className={styles.primary} onClick={load}>
          다시 시도
        </button>
      </div>
    )
  }

  if (state.stocks.length === 0) {
    return (
      <div className={styles.message}>
        <p className={styles.messageText}>아직 관심종목이 없어요</p>
        <p className={styles.hint}>홈 시세표에서 하트를 누르면 여기에 모여요.</p>
        <Link to="/" className={styles.primary}>
          종목 보러 가기
        </Link>
      </div>
    )
  }

  return (
    <>
      <p className={styles.asOf}>{toKoreanDate(state.baseDate)} 종가 기준</p>

      <ul className={styles.list}>
        {state.stocks.map((stock) => (
          <li key={stock.stockCode} className={styles.row}>
            <div className={styles.identity}>
              <Link to={`/stocks/${stock.stockCode}`} className={styles.name}>
                {stock.stockName}
              </Link>
              <span className={styles.code}>{stock.stockCode}</span>
            </div>

            <span className={styles.numeric}>{formatPrice(stock.closePrice)}</span>
            <span className={rateClassName(stock.fluctuate)}>
              {formatChangeRate(stock.fluctuate)}
            </span>
            <span className={`${styles.numeric} ${styles.colValue}`}>
              {formatTradingValue(stock.tradingValue)}
            </span>

            <button
              type="button"
              className={styles.unlike}
              onClick={() => void handleUnlike(stock.stockCode)}
              aria-label={`${stock.stockName} 관심종목 해제`}
            >
              해제
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
