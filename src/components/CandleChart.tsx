import { useEffect, useRef } from 'react'
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
} from 'lightweight-charts'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import type { Candle } from '../types/market'
import { toDashedYmd } from '../utils/date'
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

export default function CandleChart({ candles }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const chartRef = useRef<IChartApi | null>(null)

  // 차트는 마운트할 때 한 번만 만든다. 데이터가 바뀔 때마다 새로 만들면 눈에 띄게 깜빡인다
  useEffect(() => {
    const container = containerRef.current
    if (container === null) return

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#fff' },
        textColor: '#8b95a1',
        fontFamily: "'Pretendard', -apple-system, system-ui, sans-serif",
        fontSize: 12,
        panes: { separatorColor: '#e5e8eb', enableResize: false },
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

  return <div ref={containerRef} className={styles.chart} />
}
