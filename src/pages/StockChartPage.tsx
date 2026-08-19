import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CandleChart from '../components/CandleChart'
import NewsList from '../components/NewsList'
import Skeleton from '../components/Skeleton'
import { findStock, getStockDetail } from '../api/stock'
import { toKoreanDate, toPlainYmd } from '../utils/date'
import {
  formatChangeRate,
  formatPrice,
  formatVolume,
  isFlatRate,
} from '../utils/format'
import type { Candle } from '../types/market'
import type { DailyPrice, StockDetail, StockPeriod } from '../types/stock'
import styles from './StockChartPage.module.css'

/**
 * 차트에 담을 기간.
 *
 * ⚠️ 값이 **단수형**이다(`THREE_MONTH`). 백테스트 쪽 기간은 복수형(`THREE_MONTHS`)이라
 * 같은 백엔드인데도 다르다. 복사해 오지 말 것.
 */
const PERIODS: { key: StockPeriod; label: string }[] = [
  { key: 'ONE_WEEK', label: '1주' },
  { key: 'ONE_MONTH', label: '1개월' },
  { key: 'THREE_MONTH', label: '3개월' },
  { key: 'SIX_MONTH', label: '6개월' },
  { key: 'ONE_YEAR', label: '1년' },
  { key: 'THREE_YEAR', label: '3년' },
  { key: 'ALL', label: '전체' },
]

/** 예전에 증권사에서 365일치를 받아 오던 것과 같은 범위로 맞춘다 */
const DEFAULT_PERIOD: StockPeriod = 'ONE_YEAR'

/** 백엔드 daily_price 한 줄 → 차트가 읽는 형태. 날짜만 YYYYMMDD로 맞추면 된다 */
function toCandle(daily: DailyPrice): Candle {
  return {
    date: toPlainYmd(daily.date),
    open: daily.openPrice,
    high: daily.highPrice,
    low: daily.lowPrice,
    close: daily.closePrice,
    volume: daily.volume,
  }
}

function toRateClassName(rate: number | null): string | undefined {
  if (rate === null) return undefined
  if (isFlatRate(rate)) return styles.flat
  return rate > 0 ? styles.up : styles.down
}

export default function StockChartPage() {
  const { stockCode } = useParams<{ stockCode: string }>()

  /*
   * 목록에 있는 종목이면 이름을 즉시 그린다. 응답을 기다리는 동안 제목이 비어 보이지
   * 않게 하려는 것뿐이고, 진짜 이름은 아래 응답의 stockName이다.
   */
  const hint = stockCode === undefined ? null : findStock(stockCode)

  const [detail, setDetail] = useState<StockDetail | null>(null)
  const [period, setPeriod] = useState<StockPeriod>(DEFAULT_PERIOD)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (stockCode === undefined) return

    // 종목이나 기간을 빠르게 갈아타면 늦게 온 응답이 최신 응답을 덮어쓸 수 있다
    let isStale = false
    setIsLoading(true)
    setErrorMessage(null)

    getStockDetail(stockCode, period)
      .then((result) => {
        if (!isStale) setDetail(result)
      })
      .catch((error: unknown) => {
        if (isStale) return
        console.warn('종목 상세 조회 실패', error)
        setDetail(null)
        setErrorMessage(
          error instanceof Error ? error.message : '종목을 불러오지 못했습니다.',
        )
      })
      .finally(() => {
        if (!isStale) setIsLoading(false)
      })

    return () => {
      isStale = true
    }
  }, [stockCode, period])

  const candles = useMemo(
    () => (detail === null ? [] : detail.dailyPrices.map(toCandle)),
    [detail],
  )

  /*
   * 시·고·저·거래량은 **마지막 확정 거래일** 것이다.
   *
   * 예전에는 증권사 현재가 응답에서 꺼내 썼는데, 그건 "오늘 장" 기준이라 장이 열리기
   * 전에는 전부 0으로 와서 네 칸이 통째로 "-"가 됐다. 지금은 DB에서 오므로 언제 들어와도
   * 값이 있다. 대신 오늘 것이 아니므로 어느 날 기준인지 함께 적는다.
   */
  const lastDaily =
    detail === null || detail.dailyPrices.length === 0
      ? null
      : detail.dailyPrices[detail.dailyPrices.length - 1]

  if (stockCode === undefined) {
    return (
      <section className={styles.section}>
        <h1 className={styles.heading}>목록에 없는 종목입니다</h1>
        <Link to="/" className={styles.backLink}>
          홈으로 돌아가기
        </Link>
      </section>
    )
  }

  // 서버가 모르는 종목코드다. 기간을 바꿔도 소용없으니 화면을 통째로 접는다
  if (errorMessage !== null && detail === null && hint === null) {
    return (
      <section className={styles.section}>
        <h1 className={styles.heading}>{errorMessage}</h1>
        <Link to="/" className={styles.backLink}>
          홈으로 돌아가기
        </Link>
      </section>
    )
  }

  const stockName = detail?.stockName ?? hint?.stockName ?? stockCode
  const changeRate = detail?.comparePrev ?? null

  return (
    <>
      <section className={styles.section}>
        {/* 뒤로 가기 말고는 목록으로 돌아갈 길이 없었다 */}
        <Link to="/" className={styles.back}>
          <span aria-hidden="true">‹</span> 홈으로 돌아가기
        </Link>

        <h1 className={styles.identity}>
          <span className={styles.name}>{stockName}</span>
          <span className={styles.code}>{stockCode}</span>
        </h1>

        <p className={styles.price}>
          {formatPrice(detail?.currentPrice ?? null)}
        </p>

        <p className={styles.change}>
          전일 대비{' '}
          <span className={toRateClassName(changeRate)}>
            {formatChangeRate(changeRate)}
          </span>
        </p>

        <div className={styles.periods}>
          {PERIODS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={
                period === item.key
                  ? `${styles.period} ${styles.periodOn}`
                  : styles.period
              }
              onClick={() => setPeriod(item.key)}
              aria-pressed={period === item.key}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={styles.chartBox}>
          {errorMessage !== null && (
            <p className={styles.chartMessage}>차트를 불러오지 못했습니다.</p>
          )}

          {errorMessage === null && isLoading && candles.length === 0 && (
            <Skeleton className={styles.chartSkeleton} label="차트를 불러오는 중" />
          )}

          {errorMessage === null && !isLoading && candles.length === 0 && (
            <p className={styles.chartMessage}>이 기간에는 거래 기록이 없습니다.</p>
          )}

          {errorMessage === null && candles.length > 0 && (
            <CandleChart candles={candles} />
          )}
        </div>

        {lastDaily !== null && (
          <>
            <dl className={styles.summary}>
              <div className={styles.summaryItem}>
                <dt className={styles.summaryLabel}>시가</dt>
                <dd className={styles.summaryValue}>
                  {formatPrice(lastDaily.openPrice)}
                </dd>
              </div>
              <div className={styles.summaryItem}>
                <dt className={styles.summaryLabel}>고가</dt>
                <dd className={`${styles.summaryValue} ${styles.up}`}>
                  {formatPrice(lastDaily.highPrice)}
                </dd>
              </div>
              <div className={styles.summaryItem}>
                <dt className={styles.summaryLabel}>저가</dt>
                <dd className={`${styles.summaryValue} ${styles.down}`}>
                  {formatPrice(lastDaily.lowPrice)}
                </dd>
              </div>
              <div className={styles.summaryItem}>
                <dt className={styles.summaryLabel}>거래량</dt>
                <dd className={styles.summaryValue}>
                  {formatVolume(lastDaily.volume)}
                </dd>
              </div>
            </dl>

            <p className={styles.summaryNote}>
              {toKoreanDate(toPlainYmd(lastDaily.date))} 장 기준
            </p>
          </>
        )}
      </section>

      <section className={styles.section}>
        {/* 종목이 바뀌면 정렬·페이지를 처음부터 다시 잡게 통째로 새로 그린다 */}
        <NewsList key={stockCode} stockCode={stockCode} />
      </section>
    </>
  )
}
