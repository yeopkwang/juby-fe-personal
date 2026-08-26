import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CandleChart from '../components/CandleChart'
import ErrorBoundary from '../components/ErrorBoundary'
import LoadFailure from '../components/LoadFailure'
import NewsList from '../components/NewsList'
import Skeleton from '../components/Skeleton'
import { findStock, getStockDetail } from '../api/stock'
import { toKoreanDate, toPlainYmd } from '../utils/date'
import { isRetryable, toUserMessage } from '../utils/error'
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
 * 이 화면이 그리는 건 일봉 하나뿐이다.
 *
 * 예전에는 7개 버튼으로 기간을 골랐는데 봉이 한 종류뿐인 화면에서 '3개월'은
 * "3개월짜리 봉"으로 읽힌다. 지금은 전부 받아 두고 처음엔 최근 30봉만 열어 둔다.
 *
 * ⚠️ 손볼 일이 생기면 StockPeriod의 주석을 먼저 읽는다. 백테스트 쪽과 열거값이
 * 갈려 있어서(단수 THREE_MONTH vs 복수 THREE_MONTHS) 복사하면 400이 온다.
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
  /** 다시 눌러 볼 만한 실패였는가. 없는 종목(404)이면 버튼을 내밀지 않는다 */
  const [canRetry, setCanRetry] = useState(false)
  /**
   * '다시 시도'를 누른 횟수. 바뀌면 아래 effect가 한 번 더 돈다.
   * 요청 함수를 따로 빼면 effect가 하는 "늦게 온 응답 버리기"를 그쪽에도 만들어야 한다.
   */
  const [retryCount, setRetryCount] = useState(0)

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
        // 예전에는 error.message를 그대로 써서 개발자용 문구가 제목에 박혔다
        setErrorMessage(toUserMessage(error, '목록에 없는 종목입니다'))
        setCanRetry(isRetryable(error))
      })
      .finally(() => {
        if (!isStale) setIsLoading(false)
      })

    return () => {
      isStale = true
    }
  }, [stockCode, retryCount])

  const candles = useMemo(
    () => (detail === null ? [] : detail.dailyPrices.map(toCandle)),
    [detail],
  )

  /*
   * 아래 표에 세우는 값들은 마지막 확정 거래일 것이다.
   * 예전에는 증권사 현재가 응답에서 꺼내 써서 장 전에 통째로 "-"였다. 지금은 DB에서
   * 오므로 언제 들어와도 값이 있고, 대신 어느 날 기준인지 함께 적는다.
   */
  const lastDaily =
    detail === null || detail.dailyPrices.length === 0
      ? null
      : detail.dailyPrices[detail.dailyPrices.length - 1]

  /** 다시 시도. 값만 올리면 위 effect가 같은 길로 한 번 더 돈다 */
  function handleRetry() {
    setRetryCount((count) => count + 1)
  }

  if (stockCode === undefined) {
    return (
      <section className={styles.section}>
        <h1 className={styles.heading}>목록에 없는 종목입니다</h1>
        <div className={styles.foldActions}>
          <Link to="/" className={styles.backLink}>
            홈으로 돌아가기
          </Link>
        </div>
      </section>
    )
  }

  /*
   * 목록에도 없고 서버도 모르는 종목코드다. 그릴 이름조차 없어 화면을 통째로 접는다.
   * 접더라도 나갈 길은 둘 다 준다 — 500·무응답이면 다시 눌러 볼 만하고, 404면
   * 다시 물어도 없으므로 그때는 버튼을 그리지 않는다.
   */
  if (errorMessage !== null && detail === null && hint === null) {
    return (
      <section className={styles.section}>
        <h1 className={styles.heading}>{errorMessage}</h1>

        <div className={styles.foldActions}>
          {canRetry && (
            <button
              type="button"
              className={styles.foldRetry}
              onClick={handleRetry}
              disabled={isLoading}
            >
              {isLoading ? '불러오는 중…' : '다시 시도'}
            </button>
          )}
          <Link to="/" className={styles.backLink}>
            홈으로 돌아가기
          </Link>
        </div>
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
                {/*
                  종가가 빠져 있었다. 시·고·저만 있고 그 장이 **얼마로 끝났는지**가
                  없었던 셈이라, 하루의 이야기가 결말 없이 끊겼다.
                  왼쪽 현재가로 대신 읽을 수도 없다 — 그건 오늘 값이고 이건 지난 장이다.

                  고가·저가와 달리 색을 칠하지 않는다. 빨강·파랑은 '오르고 내림'인데
                  종가의 오르내림은 그 전날과 견줘야 나오는 값이라 여기에 없다.
                  칠하면 고가는 빨강, 저가는 파랑이라는 뜻과 섞여 잘못 읽힌다.
                */}
                <div className={styles.factsRow}>
                  <dt className={styles.factsLabel}>종가</dt>
                  <dd className={styles.factsValue}>
                    {formatPrice(lastDaily.closePrice)}
                  </dd>
                </div>

                {/*
                  factsRowWide는 **좁은 화면에서만** 쓰인다. 3열로 접힐 때 두 번째
                  줄에 한 자리가 남는데, 거래량이 두 칸을 먹어 그 구멍을 메운다.
                  넓은 화면에서는 다섯이 한 줄이라 아무 일도 하지 않는다.
                */}
                <div className={`${styles.factsRow} ${styles.factsRowWide}`}>
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
            {/*
              이름은 떴는데 차트만 못 받은 경우다(목록에 있는 종목). 화면을 접지 않고
              차트 자리만 안내로 채운다. 서버가 흔들린 것뿐이면 여기서 바로 다시 받는다.
            */}
            {errorMessage !== null && (
              <LoadFailure
                message={errorMessage}
                onRetry={canRetry ? handleRetry : undefined}
                isRetrying={isLoading}
              />
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
        {/* 뉴스가 그리다 터져도 이 칸만 비운다. 차트·시세까지 함께 사라지면 안 된다 */}
        <ErrorBoundary
          resetKey={stockCode}
          fallback={<LoadFailure message="뉴스를 불러오지 못했습니다." />}
        >
          {/* 종목이 바뀌면 정렬·페이지를 처음부터 다시 잡게 통째로 새로 그린다 */}
          <NewsList key={stockCode} stockCode={stockCode} />
        </ErrorBoundary>
      </section>
    </>
  )
}
