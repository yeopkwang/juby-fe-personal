import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CandleChart from '../components/CandleChart'
import NewsList from '../components/NewsList'
import { ApiError } from '../api/client'
import { getStockDetail } from '../api/stock'
import { withRetry } from '../utils/async'
import { toKoreanDate, toYmd, ymdToDate } from '../utils/date'
import {
  formatChangeRate,
  formatPrice,
  formatVolume,
  isFlatRate,
} from '../utils/format'
import type { Candle, Period, StockDetail } from '../types/stock'
import styles from './StockChartPage.module.css'

/** 백엔드 Period enum 순서 그대로. 화면 탭도 이 순서로 놓는다 */
const PERIOD_TABS: { period: Period; label: string }[] = [
  { period: 'ONE_WEEK', label: '1주' },
  { period: 'ONE_MONTH', label: '1개월' },
  { period: 'THREE_MONTH', label: '3개월' },
  { period: 'SIX_MONTH', label: '6개월' },
  { period: 'ONE_YEAR', label: '1년' },
  { period: 'THREE_YEAR', label: '3년' },
  { period: 'ALL', label: '전체' },
]

/** 처음 열었을 때 기간. 60봉쯤이 봉 모양과 흐름이 함께 읽히는 길이다 */
const DEFAULT_PERIOD: Period = 'THREE_MONTH'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; detail: StockDetail }
  /** 백엔드 stock 테이블에 없는 종목코드 */
  | { kind: 'notFound' }
  | { kind: 'error' }

/**
 * 마지막 거래일에서 기간만큼 거슬러 올라간 시작일(YYYYMMDD).
 * 백엔드 StockService.calculateDay와 같은 규칙이라 서버에 period를 보낸 것과 결과가 같다.
 *
 * 서버에 기간마다 다시 묻지 않는 이유: 상세 API는 일봉은 DB에서 주지만 현재가 하나를
 * 증권사에 물어본다. 탭을 누를 때마다 그 호출이 나가는 건 낭비라 ALL로 한 번 받고 여기서 자른다.
 */
function periodStart(lastYmd: string, period: Period): string | null {
  if (period === 'ALL') return null

  const date = ymdToDate(lastYmd)
  switch (period) {
    case 'ONE_WEEK':
      date.setDate(date.getDate() - 7)
      break
    case 'ONE_MONTH':
      date.setMonth(date.getMonth() - 1)
      break
    case 'THREE_MONTH':
      date.setMonth(date.getMonth() - 3)
      break
    case 'SIX_MONTH':
      date.setMonth(date.getMonth() - 6)
      break
    case 'ONE_YEAR':
      date.setFullYear(date.getFullYear() - 1)
      break
    case 'THREE_YEAR':
      date.setFullYear(date.getFullYear() - 3)
      break
  }
  return toYmd(date)
}

function sliceByPeriod(candles: Candle[], period: Period): Candle[] {
  const last = candles.at(-1)
  if (last === undefined) return candles

  const start = periodStart(last.date, period)
  // 날짜가 YYYYMMDD 문자열이라 사전순 비교가 곧 날짜순 비교다
  return start === null ? candles : candles.filter((c) => c.date >= start)
}

function toRateClassName(rate: number): string | undefined {
  if (isFlatRate(rate)) return styles.flat
  return rate > 0 ? styles.up : styles.down
}

export default function StockChartPage() {
  const { stockCode } = useParams<{ stockCode: string }>()

  const [state, setState] = useState<State>({ kind: 'loading' })
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD)

  const load = useCallback(() => {
    if (stockCode === undefined) return

    setState({ kind: 'loading' })

    // 증권사 초당 제한에 걸리면 500이 온다. 한 번 더 부르면 대개 통과한다
    withRetry(() => getStockDetail(stockCode, 'ALL'), 1, 400)
      .then((detail) => setState({ kind: 'ready', detail }))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          setState({ kind: 'notFound' })
          return
        }
        console.warn('종목 상세 조회 실패', error)
        setState({ kind: 'error' })
      })
  }, [stockCode])

  useEffect(() => {
    // 종목을 빠르게 갈아타면 늦게 온 응답이 최신 응답을 덮어쓸 수 있다
    let isStale = false
    const guarded = () => {
      if (!isStale) load()
    }
    guarded()
    return () => {
      isStale = true
    }
  }, [load])

  if (state.kind === 'notFound') {
    return (
      <section className={styles.section}>
        <h1 className={styles.heading}>목록에 없는 종목입니다</h1>
        <Link to="/" className={styles.backLink}>
          홈으로 돌아가기
        </Link>
      </section>
    )
  }

  if (state.kind === 'error') {
    return (
      <section className={styles.section}>
        <h1 className={styles.heading}>종목 정보를 불러오지 못했습니다</h1>
        <div className={styles.actions}>
          <button type="button" className={styles.retryButton} onClick={load}>
            다시 시도
          </button>
          <Link to="/" className={styles.backLink}>
            홈으로 돌아가기
          </Link>
        </div>
      </section>
    )
  }

  const detail = state.kind === 'ready' ? state.detail : null
  const shown = detail === null ? [] : sliceByPeriod(detail.candles, period)
  const lastCandle = shown.at(-1) ?? null
  const rateClassName =
    detail === null ? undefined : toRateClassName(detail.comparePrev)

  return (
    <>
      <section className={styles.section}>
        {/* 뒤로 가기 말고는 목록으로 돌아갈 길이 없었다 */}
        <Link to="/" className={styles.back}>
          <span aria-hidden="true">‹</span> 홈으로 돌아가기
        </Link>

        <h1 className={styles.identity}>
          {/* 이름은 응답에 실려 온다. 오기 전엔 코드만 적는다 */}
          <span className={styles.name}>{detail?.stockName ?? ''}</span>
          <span className={styles.code}>{stockCode}</span>
        </h1>

        <p className={styles.price}>
          {formatPrice(detail?.currentPrice ?? null)}
        </p>

        <p className={styles.change}>
          전일 대비{' '}
          <span className={rateClassName}>
            {formatChangeRate(detail?.comparePrev ?? null)}
          </span>
        </p>

        {/* 탭이 곧 확대·축소다. 받아 둔 전체 일봉을 여기서 잘라 차트에 넘긴다 */}
        <div className={styles.periodTabs} role="tablist" aria-label="기간">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.period}
              type="button"
              role="tab"
              aria-selected={tab.period === period}
              className={
                tab.period === period
                  ? `${styles.periodTab} ${styles.periodTabActive}`
                  : styles.periodTab
              }
              onClick={() => setPeriod(tab.period)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.chartBox}>
          {detail === null && <div className={styles.chartSkeleton} />}

          {detail !== null && shown.length === 0 && (
            <p className={styles.chartMessage}>이 기간에는 거래일이 없습니다.</p>
          )}

          {shown.length > 0 && <CandleChart candles={shown} />}
        </div>

        {/*
          마지막 거래일의 시·고·저·거래량. 현재가 API는 이 값을 안 주고(현재가·등락률뿐),
          일봉 테이블은 장 마감 후 확정값만 들어가므로 "오늘"이 아니라 어느 날인지 함께 적는다.
        */}
        {lastCandle !== null && (
          <>
            <p className={styles.summaryDate}>
              {toKoreanDate(lastCandle.date)} 마감 기준
            </p>
            <dl className={styles.summary}>
              <div className={styles.summaryItem}>
                <dt className={styles.summaryLabel}>시가</dt>
                <dd className={styles.summaryValue}>
                  {formatPrice(lastCandle.open)}
                </dd>
              </div>
              <div className={styles.summaryItem}>
                <dt className={styles.summaryLabel}>고가</dt>
                <dd className={`${styles.summaryValue} ${styles.up}`}>
                  {formatPrice(lastCandle.high)}
                </dd>
              </div>
              <div className={styles.summaryItem}>
                <dt className={styles.summaryLabel}>저가</dt>
                <dd className={`${styles.summaryValue} ${styles.down}`}>
                  {formatPrice(lastCandle.low)}
                </dd>
              </div>
              <div className={styles.summaryItem}>
                <dt className={styles.summaryLabel}>거래량</dt>
                <dd className={styles.summaryValue}>
                  {formatVolume(lastCandle.volume)}
                </dd>
              </div>
            </dl>
          </>
        )}
      </section>

      {stockCode !== undefined && (
        <section className={styles.section}>
          <NewsList stockCode={stockCode} />
        </section>
      )}
    </>
  )
}
