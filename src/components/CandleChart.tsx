import { useEffect, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
} from 'lightweight-charts'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import type { PointerEvent } from 'react'
import type { Candle } from '../types/market'
import { toDashedYmd, toKoreanDate } from '../utils/date'
import { formatChangeRate, isFlatRate } from '../utils/format'
import styles from './CandleChart.module.css'

/** 국내 시장 관례대로 오르면 빨강, 내리면 파랑 */
const UP_COLOR = '#f04452'
const DOWN_COLOR = '#3182f6'
const UP_VOLUME_COLOR = 'rgba(240, 68, 82, 0.35)'
const DOWN_VOLUME_COLOR = 'rgba(49, 130, 246, 0.35)'

/** 처음에 보여줄 봉 개수. 나머지 과거 일봉은 옆으로 밀거나 축소해서 본다 */
const INITIAL_VISIBLE_BARS = 30

/** 아래 거래량 칸이 차지할 높이 비율 */
const VOLUME_PANE_RATIO = 0.26

/** 가격 눈금. 원 단위라 세 자리 콤마만 넣는다 */
function formatPriceTick(price: number): string {
  return Math.round(price).toLocaleString('ko-KR')
}

/** 거래량 눈금. 주 단위 숫자가 길어서 만·억으로 줄인다. 1,234,567 → "123만" */
function formatVolume(volume: number): string {
  if (volume >= 100_000_000) return `${(volume / 100_000_000).toFixed(1)}억`
  if (volume >= 10_000) {
    return `${Math.round(volume / 10_000).toLocaleString('ko-KR')}만`
  }
  return Math.round(volume).toLocaleString('ko-KR')
}

interface Props {
  candles: Candle[]
}

/** 봉 하나와 그 전날 종가. 등락률을 내려면 전날 종가가 있어야 한다 */
interface Point {
  candle: Candle
  /** 첫 봉은 이전 봉이 없어 null */
  prevClose: number | null
}

/** 따라다니는 박스를 놓을 자리. 감싼 div의 왼쪽 위를 원점으로 한 픽셀 좌표다 */
interface CursorSpot {
  x: number
  y: number
  /**
   * 커서가 오른쪽(아래) 절반에 있는가. 그러면 박스를 반대쪽에 붙여 차트 밖으로
   * 삐져나가지 않게 한다.
   *
   * 박스 크기를 재서 "넘치는가"를 따지지 않는 이유는, 재려면 그 값을 CSS와 JS
   * 두 곳에 적어야 하고 여백을 조금만 손봐도 어긋나기 때문이다. 절반을 기준으로
   * 삼으면 박스가 커져도 규칙이 그대로 맞는다 — 차트 절반보다 넓어질 일은 없다.
   */
  flipX: boolean
  flipY: boolean
}

export default function CandleChart({ candles }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const chartRef = useRef<IChartApi | null>(null)

  /** 크로스헤어가 가리키는 봉. 차트 밖으로 나가면 null이 되고 마지막 봉을 대신 보여준다 */
  const [hovered, setHovered] = useState<Point | null>(null)

  /**
   * 따라다니는 박스를 놓을 자리. 차트 밖으로 나가면 null.
   *
   * 차트 라이브러리가 주는 좌표(param.point)를 쓰지 않는다. 아래 거래량 칸이 별도
   * pane이라 그 안에서는 원점이 달라지는데, 박스는 두 칸에 걸쳐 하나만 떠야 한다.
   * 감싼 div 기준으로 직접 재면 칸이 몇 개든 상관이 없다.
   */
  const [cursor, setCursor] = useState<CursorSpot | null>(null)

  /*
   * 크로스헤어 핸들러가 봉을 찾아볼 표. 구독은 한 번만 걸고 데이터가 바뀌면 이 ref만
   * 갈아끼운다 — candles를 클로저로 잡으면 종목마다 구독을 다시 걸어야 한다.
   */
  const pointsRef = useRef(new Map<string, Point>())

  // 차트는 마운트할 때 한 번만 만든다. 데이터가 바뀔 때마다 새로 만들면 눈에 띄게 깜빡인다
  useEffect(() => {
    const container = containerRef.current
    if (container === null) return

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#fff' },
        textColor: '#8b95a1',
        /* index.css의 body와 같은 순서로 둔다. 다르면 축 눈금만 다른 글꼴이 된다 */
        fontFamily:
          "'Pretendard Variable', 'Pretendard', -apple-system, system-ui, sans-serif",
        fontSize: 12,
        panes: { separatorColor: '#e5e8eb', enableResize: false },
        /*
         * 라이브러리가 왼쪽 아래에 붙이는 TradingView 배지를 끈다.
         * 그 자리가 하필 거래량 막대의 첫 두세 개 위라 값을 가린다(좁은 화면에서 특히).
         *
         * 끄는 대신 표시는 차트 아래에 글자로 남긴다 — StockChartPage의 credit.
         * 라이선스가 Apache-2.0이라 배지 자체가 의무는 아니지만, 남의 것을 쓰면서
         * 이름을 지우는 것은 다른 문제다.
         */
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#f4f5f7' },
        horzLines: { color: '#f4f5f7' },
      },
      rightPriceScale: {
        borderColor: '#e5e8eb',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#e5e8eb',
        // 데이터 바깥의 빈 공간까지 밀려나가지 않도록 양끝을 막아 둔다
        fixLeftEdge: true,
        fixRightEdge: true,
        minBarSpacing: 0.8,
      },
      // 차트를 잡아끌면 과거로, 휠이나 시간축을 끌면 간격이 좁아지며 더 많은 봉이 들어온다
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: false },
      },
      crosshair: { mode: CrosshairMode.Normal },
      localization: { locale: 'ko-KR' },
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
      priceFormat: { type: 'custom', formatter: formatPriceTick, minMove: 1 },
      /*
       * 오른쪽 눈금의 빨간 값 배지를 끈다. 두 가지가 걸렸다.
       *
       * ① 눈금 글자를 덮는다. 삼성전자(약 178만원)에서 "1,800,000"의 아래 절반만
       *    남는 것을 확인했다(1280·390 폭 모두). 배지 높이는 정할 수 없고 종가에
       *    따라 어디든 가므로 여백으로는 못 피한다.
       * ② 화면에 '지금 값'이 두 개가 된다. 위쪽 큰 숫자는 현재가이고 이 배지는
       *    마지막 확정 거래일의 종가라 장중에는 서로 다르다.
       *
       * 점선(priceLineVisible)은 남긴다. 숫자가 아니라 높이를 긋는 선이라 아무것도
       * 가리지 않는다. 종가 숫자는 범례와 '지난 장' 표에 이미 있다.
       */
      lastValueVisible: false,
    })

    /*
     * 거래량은 주가와 자릿수가 딴판이라 같은 눈금에 얹으면 축이 주가에 끌려간다.
     * 아래 칸(pane 1)으로 떼어내면 거래량만의 눈금이 그 칸 안에서 매겨진다.
     */
    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: 'custom', formatter: formatVolume, minMove: 1 },
        priceLineVisible: false,
        lastValueVisible: false,
      },
      1,
    )

    volumeSeries.priceScale().applyOptions({
      borderColor: '#e5e8eb',
      scaleMargins: { top: 0.2, bottom: 0 },
    })

    function resizeVolumePane() {
      const panes = chart.panes()
      if (panes.length < 2 || container === null) return
      panes[1].setHeight(
        Math.round(container.clientHeight * VOLUME_PANE_RATIO),
      )
    }

    resizeVolumePane()

    // autoSize가 높이를 다시 잡으면 아래 칸 비율도 따라가야 한다
    const observer = new ResizeObserver(resizeVolumePane)
    observer.observe(container)

    /*
     * 마우스가 어느 봉을 짚었는지만 여기서 정한다. 그 값을 어디에 그릴지는
     * 아래 렌더가 정한다 — 커서 옆 박스이거나, 아무것도 안 짚었으면 위쪽 범례다.
     * 차트 밖으로 나가면 time이 비어 오는데, 그때는 짚은 봉이 없는 것으로 둔다.
     */
    chart.subscribeCrosshairMove((param) => {
      const time = param.time
      setHovered(typeof time === 'string' ? pointsRef.current.get(time) ?? null : null)
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
    }
  }, [])

  useEffect(() => {
    const candleSeries = candleSeriesRef.current
    const volumeSeries = volumeSeriesRef.current
    if (candleSeries === null || volumeSeries === null) return

    // 종목이 바뀌면 지난 종목의 봉이 남아 엉뚱한 값을 띄운다. 매번 새로 만든다
    pointsRef.current = new Map(
      candles.map((candle, index) => [
        toDashedYmd(candle.date),
        { candle, prevClose: index === 0 ? null : candles[index - 1].close },
      ]),
    )
    setHovered(null)

    candleSeries.setData(
      candles.map((candle) => ({
        time: toDashedYmd(candle.date),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    )

    volumeSeries.setData(
      candles.map((candle) => ({
        time: toDashedYmd(candle.date),
        value: candle.volume,
        color:
          candle.close >= candle.open ? UP_VOLUME_COLOR : DOWN_VOLUME_COLOR,
      })),
    )

    // 1년치를 다 받아 두고 최근 30봉만 열어 둔다. 나머지는 밀어서 꺼내 본다
    if (candles.length > 0) {
      chartRef.current?.timeScale().setVisibleLogicalRange({
        from: Math.max(0, candles.length - INITIAL_VISIBLE_BARS),
        to: candles.length - 1,
      })
    }
  }, [candles])

  /*
   * 마우스를 올리기 전에는 가장 최근 봉을 보여준다.
   * 빈 자리로 두면 마우스가 들어올 때마다 줄이 생겼다 사라져 차트가 흔들린다.
   */
  const lastIndex = candles.length - 1
  const shown =
    hovered ??
    (lastIndex < 0
      ? null
      : {
          candle: candles[lastIndex],
          prevClose: lastIndex < 1 ? null : candles[lastIndex - 1].close,
        })

  /*
   * 짚은 봉이 있고 커서 자리도 알면 따라다니는 박스를 띄운다.
   *
   * 봉과 자리를 따로 받는다. 어느 봉인지는 차트가 알려주고(크로스헤어),
   * 어디에 놓을지는 이 div가 안다. 둘 중 하나만 있으면 띄울 수 없다 —
   * 예를 들어 차트 안이지만 봉이 없는 빈 구간이면 hovered가 null이다.
   */
  const tooltip =
    hovered === null || cursor === null ? null : { point: hovered, cursor }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    setCursor({
      x,
      y,
      flipX: x > rect.width / 2,
      flipY: y > rect.height / 2,
    })
  }

  return (
    <div
      className={styles.wrap}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setCursor(null)}
    >
      {/*
        범례와 박스는 같은 숫자를 말하므로 동시에 띄우지 않는다.
        범례는 아무것도 안 짚었을 때의 자리(마지막 봉)를 맡고,
        짚는 동안은 눈이 가 있는 커서 옆에서 박스가 대신 말한다.
      */}
      {shown !== null && tooltip === null && <Legend point={shown} />}
      <div ref={containerRef} className={styles.chart} />
      {tooltip !== null && (
        <Tooltip point={tooltip.point} cursor={tooltip.cursor} />
      )}
    </div>
  )
}

/**
 * 전날 종가 대비 등락률과 그 색.
 *
 * 범례와 따라다니는 박스가 같이 쓴다. 한쪽에만 고치면 같은 봉을 짚었는데 위아래가
 * 다른 색으로 말하게 된다.
 */
function toRate(point: Point): { rate: number | null; color: string | undefined } {
  const { candle, prevClose } = point

  const rate =
    prevClose === null || prevClose === 0
      ? null
      : ((candle.close - prevClose) / prevClose) * 100

  const color =
    rate === null || isFlatRate(rate)
      ? undefined
      : rate > 0
        ? UP_COLOR
        : DOWN_COLOR

  return { rate, color }
}

/**
 * 짚은 봉의 값을 커서 옆에 띄우는 작은 박스.
 *
 * 위쪽 범례가 이미 같은 값을 말하지만 눈이 가 있는 곳은 커서다. 봉 하나를 짚어 놓고
 * 값을 읽으러 화면 위쪽까지 올라갔다 내려오면 어느 봉이었는지 놓친다.
 *
 * pointer-events를 끄는 것이 중요하다(CSS). 박스가 커서를 막으면 그 아래 봉의
 * 크로스헤어가 끊겨서, 박스가 자기 자신을 가리는 자리에서 값이 멈춘다.
 */
function Tooltip({ point, cursor }: { point: Point; cursor: CursorSpot }) {
  const { candle } = point
  const { rate, color } = toRate(point)

  const rows: { label: string; value: string; color?: string }[] = [
    { label: '시가', value: formatPriceTick(candle.open) },
    { label: '고가', value: formatPriceTick(candle.high) },
    { label: '저가', value: formatPriceTick(candle.low) },
    { label: '종가', value: formatPriceTick(candle.close), color },
    { label: '거래량', value: `${formatVolume(candle.volume)}주` },
  ]

  return (
    <div
      className={styles.tooltip}
      style={{ left: cursor.x, top: cursor.y }}
      data-flip-x={cursor.flipX}
      data-flip-y={cursor.flipY}
    >
      <div className={styles.tooltipHead}>
        <span>{toKoreanDate(candle.date)}</span>
        {rate !== null && (
          <b style={{ color }}>{formatChangeRate(rate)}</b>
        )}
      </div>

      <dl className={styles.tooltipRows}>
        {rows.map((row) => (
          <div key={row.label} className={styles.tooltipRow}>
            <dt>{row.label}</dt>
            <dd style={{ color: row.color }}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** 차트 위에 겹쳐 놓는 그날의 값. 마우스를 가리지 않도록 클릭은 통과시킨다(CSS) */
function Legend({ point }: { point: Point }) {
  const { candle } = point
  const { rate, color: rateColor } = toRate(point)

  return (
    <div className={styles.legend}>
      <span className={styles.legendDate}>{toKoreanDate(candle.date)}</span>

      <span>
        시 <b>{formatPriceTick(candle.open)}</b>
      </span>
      <span>
        고 <b>{formatPriceTick(candle.high)}</b>
      </span>
      <span>
        저 <b>{formatPriceTick(candle.low)}</b>
      </span>
      <span>
        종 <b style={{ color: rateColor }}>{formatPriceTick(candle.close)}</b>
      </span>

      {rate !== null && (
        <b style={{ color: rateColor }}>{formatChangeRate(rate)}</b>
      )}

      <span className={styles.legendVolume}>
        거래량 <b>{formatVolume(candle.volume)}주</b>
      </span>
    </div>
  )
}
