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

/*
 * 이 화면이 그리는 건 **일봉 하나뿐**이다.
 *
 * 예전에는 1주·1개월·3개월…7개 버튼으로 기간을 골랐는데, 봉이 한 종류뿐인 화면에서
 * '3개월'은 "3개월짜리 봉"으로 읽힌다. 그래서 버튼을 걷어내고 차트 위에 '일봉 그래프 보기'
 * 한 줄만 남겼다. 얼마나 볼지는 버튼 대신 차트를 밀거나 좁혀서 정한다 — 있는 걸 전부 받아 두고
 * 처음엔 최근 30봉만 열어 두므로(CandleChart의 INITIAL_VISIBLE_BARS) 첫 화면은 그대로다.
 *
 * ⚠️ 이 값을 다시 손볼 일이 생기면 `StockPeriod`의 주석을 먼저 읽는다. 백테스트 쪽
 * 기간과 열거값이 갈려 있어서(단수 `THREE_MONTH` vs 복수 `THREE_MONTHS`) 복사하면 400이 온다.
 */
const CHART_PERIOD: StockPeriod = 'ALL'

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
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (stockCode === undefined) return

    // 종목을 빠르게 갈아타면 늦게 온 응답이 최신 응답을 덮어쓸 수 있다
    let isStale = false
    setIsLoading(true)
    setErrorMessage(null)

    getStockDetail(stockCode, CHART_PERIOD)
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
  }, [stockCode])

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

  // 서버가 모르는 종목코드다. 여기서 할 수 있는 게 없으니 화면을 통째로 접는다
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
          <span aria-hidden="true" className={styles.backArrow}>
            ‹
          </span>
          홈으로 돌아가기
        </Link>

        {/*
          왼쪽은 지금 값(이름·코드·현재가·등락률), 오른쪽은 마지막 확정 거래일의 표.
          성격이 다른 두 덩어리라 좌우로 갈라 놓는다 — 표를 차트 아래에 두었더니
          현재가에서 차트를 지나 한참 내려가야 시·고·저가 나왔다.
        */}
        <header className={styles.head}>
          <div className={styles.identityBlock}>
            <h1 className={styles.identity}>
              <span className={styles.name}>{stockName}</span>
              <span className={styles.code}>{stockCode}</span>
            </h1>

            <p className={styles.priceRow}>
              <span className={styles.price}>
                {formatPrice(detail?.currentPrice ?? null)}
              </span>
              <span className={styles.changeLabel}>전일 대비</span>
              <span className={`${styles.change} ${toRateClassName(changeRate)}`}>
                {formatChangeRate(changeRate)}
              </span>
            </p>
          </div>

          {lastDaily !== null && (
            <div className={styles.facts}>
              {/*
                날짜를 표의 머리에 박아 둔다. 왼쪽 현재가는 지금 값이고 이 표는
                지난 장 값이라, 나란히 놓으면 표까지 오늘 것으로 읽히기 때문이다.
              */}
              <p className={styles.factsCaption}>
                {toKoreanDate(toPlainYmd(lastDaily.date))} 장 기준
              </p>

              <dl className={styles.factsList}>
                <div className={styles.factsRow}>
                  <dt className={styles.factsLabel}>시가</dt>
                  <dd className={styles.factsValue}>
                    {formatPrice(lastDaily.openPrice)}
                  </dd>
                </div>
                <div className={styles.factsRow}>
                  <dt className={styles.factsLabel}>고가</dt>
                  <dd className={`${styles.factsValue} ${styles.up}`}>
                    {formatPrice(lastDaily.highPrice)}
                  </dd>
                </div>
                <div className={styles.factsRow}>
                  <dt className={styles.factsLabel}>저가</dt>
                  <dd className={`${styles.factsValue} ${styles.down}`}>
                    {formatPrice(lastDaily.lowPrice)}
                  </dd>
                </div>
                <div className={styles.factsRow}>
                  <dt className={styles.factsLabel}>거래량</dt>
                  <dd className={styles.factsValue}>
                    {formatVolume(lastDaily.volume)}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </header>

        <div className={styles.card}>
          {/* 고를 게 없으므로 버튼처럼 보이면 안 된다. 판의 이름표다 */}
          <h2 className={styles.cardTitle}>일봉 그래프 보기</h2>

          <div className={styles.chartBox}>
            {errorMessage !== null && (
              <p className={styles.chartMessage}>차트를 불러오지 못했습니다.</p>
            )}

            {errorMessage === null && isLoading && candles.length === 0 && (
              <Skeleton
                className={styles.chartSkeleton}
                label="차트를 불러오는 중"
              />
            )}

            {errorMessage === null && !isLoading && candles.length === 0 && (
              <p className={styles.chartMessage}>거래 기록이 없습니다.</p>
            )}

            {errorMessage === null && candles.length > 0 && (
              <CandleChart candles={candles} />
            )}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        {/* 종목이 바뀌면 정렬·페이지를 처음부터 다시 잡게 통째로 새로 그린다 */}
        <NewsList key={stockCode} stockCode={stockCode} />
      </section>
    </>
  )
}
