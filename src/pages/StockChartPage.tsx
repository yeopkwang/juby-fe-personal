import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CandleChart from '../components/CandleChart'
import NewsList from '../components/NewsList'
import { loadCandles, readCachedCandles } from '../api/candles'
import { getPrice, toChangeRate, toVolume } from '../api/market'
import { getNews } from '../api/news'
import { findStock } from '../api/stock'
import { withRetry } from '../utils/async'
import {
  formatChangeRate,
  formatPrice,
  formatVolume,
  isFlatRate,
} from '../utils/format'
import type { Candle, NewsItem } from '../types/market'
import styles from './StockChartPage.module.css'

interface Price {
  currentPrice: number
  changeRate: number
  /** 장 시작 전에는 시·고·저가 0으로 온다. 그때는 null로 바꿔 담는다 */
  open: number | null
  high: number | null
  low: number | null
  volume: number | null
}

/** 0은 "아직 값이 없다"는 뜻이다. 0원이라고 적을 수는 없다 */
function orNull(value: number): number | null {
  return value > 0 ? value : null
}

function toRateClassName(rate: number | null): string | undefined {
  if (rate === null) return undefined
  if (isFlatRate(rate)) return styles.flat
  return rate > 0 ? styles.up : styles.down
}

export default function StockChartPage() {
  const { stockCode } = useParams<{ stockCode: string }>()
  const stock = stockCode === undefined ? null : findStock(stockCode)
  const stockName = stock?.stockName ?? null

  const [candles, setCandles] = useState<Candle[]>([])
  const [isCandleLoading, setIsCandleLoading] = useState(true)
  const [hasCandleError, setHasCandleError] = useState(false)
  const [price, setPrice] = useState<Price | null>(null)
  const [news, setNews] = useState<NewsItem[]>([])
  const [isNewsLoading, setIsNewsLoading] = useState(true)
  const [hasNewsError, setHasNewsError] = useState(false)

  useEffect(() => {
    if (stockCode === undefined) return

    // 종목을 빠르게 갈아타면 늦게 온 응답이 최신 응답을 덮어쓸 수 있다
    let isStale = false

    /*
     * 받아둔 게 있으면 그걸로 먼저 그린다. 아래 요청이 끝나면 최신 값으로 갈아끼운다.
     * 종목이 바뀔 때마다 다시 정해야 해서 useState 초기값이 아니라 여기서 넣는다.
     */
    const cached = readCachedCandles(stockCode)
    setCandles(cached ?? [])
    setIsCandleLoading(cached === null)
    setHasCandleError(false)

    loadCandles(stockCode)
      .then((result) => {
        if (!isStale) setCandles(result)
      })
      .catch((error: unknown) => {
        if (isStale) return
        console.warn('일봉 조회 실패', error)
        setHasCandleError(true)
      })
      .finally(() => {
        if (!isStale) setIsCandleLoading(false)
      })

    return () => {
      isStale = true
    }
  }, [stockCode])

  useEffect(() => {
    if (stockCode === undefined) return

    let isStale = false

    withRetry(() => getPrice(stockCode))
      .then((response) => {
        if (isStale) return
        setPrice({
          currentPrice: Number(response.stck_prpr),
          changeRate: toChangeRate(response),
          open: orNull(Number(response.stck_oprc)),
          high: orNull(Number(response.stck_hgpr)),
          low: orNull(Number(response.stck_lwpr)),
          volume: toVolume(response),
        })
      })
      .catch((error: unknown) => {
        // 현재가는 없어도 차트는 보여줄 수 있으니 화면을 막지 않는다
        console.warn('현재가 조회 실패', error)
      })

    return () => {
      isStale = true
    }
  }, [stockCode])

  useEffect(() => {
    if (stockName === null) return

    let isStale = false
    setIsNewsLoading(true)
    setHasNewsError(false)

    getNews(stockName)
      .then((result) => {
        if (!isStale) setNews(result)
      })
      .catch((error: unknown) => {
        if (isStale) return
        console.warn('뉴스 조회 실패', error)
        setHasNewsError(true)
      })
      .finally(() => {
        if (!isStale) setIsNewsLoading(false)
      })

    return () => {
      isStale = true
    }
  }, [stockName])

  if (stock === null) {
    return (
      <section className={styles.section}>
        <h1 className={styles.heading}>목록에 없는 종목입니다</h1>
        <Link to="/" className={styles.backLink}>
          홈으로 돌아가기
        </Link>
      </section>
    )
  }

  const rateClassName = toRateClassName(price?.changeRate ?? null)

  return (
    <>
      <section className={styles.section}>
        {/* 뒤로 가기 말고는 목록으로 돌아갈 길이 없었다 */}
        <Link to="/" className={styles.back}>
          <span aria-hidden="true">‹</span> 홈으로 돌아가기
        </Link>

        <h1 className={styles.identity}>
          <span className={styles.name}>{stock.stockName}</span>
          <span className={styles.code}>{stock.stockCode}</span>
        </h1>

        <p className={styles.price}>
          {formatPrice(price?.currentPrice ?? null)}
        </p>

        <p className={styles.change}>
          전일 대비{' '}
          <span className={rateClassName}>
            {formatChangeRate(price?.changeRate ?? null)}
          </span>
        </p>

        <div className={styles.chartBox}>
          {hasCandleError && (
            <p className={styles.chartMessage}>차트를 불러오지 못했습니다.</p>
          )}

          {!hasCandleError && isCandleLoading && candles.length === 0 && (
            <div className={styles.chartSkeleton} />
          )}

          {!hasCandleError && candles.length > 0 && (
            <CandleChart candles={candles} />
          )}
        </div>

        {/*
          현재가 응답에 이미 담겨 오던 값들이다. 그동안 현재가와 등락률만 꺼내 쓰고 버렸다.
          장 시작 전에는 시·고·저가 0으로 오므로 그때는 "-"가 찍힌다.
        */}
        {price !== null && (
          <dl className={styles.summary}>
            <div className={styles.summaryItem}>
              <dt className={styles.summaryLabel}>시가</dt>
              <dd className={styles.summaryValue}>{formatPrice(price.open)}</dd>
            </div>
            <div className={styles.summaryItem}>
              <dt className={styles.summaryLabel}>고가</dt>
              <dd className={`${styles.summaryValue} ${styles.up}`}>
                {formatPrice(price.high)}
              </dd>
            </div>
            <div className={styles.summaryItem}>
              <dt className={styles.summaryLabel}>저가</dt>
              <dd className={`${styles.summaryValue} ${styles.down}`}>
                {formatPrice(price.low)}
              </dd>
            </div>
            <div className={styles.summaryItem}>
              <dt className={styles.summaryLabel}>거래량</dt>
              <dd className={styles.summaryValue}>
                {formatVolume(price.volume)}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className={styles.section}>
        {isNewsLoading && <p className={styles.chartMessage}>불러오는 중…</p>}

        {hasNewsError && (
          <p className={styles.chartMessage}>뉴스를 불러오지 못했습니다.</p>
        )}

        {!isNewsLoading && !hasNewsError && <NewsList news={news} />}
      </section>
    </>
  )
}
