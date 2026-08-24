import { useEffect, useRef, useState } from 'react'
import type { TopStock } from '../types/stock'
import { formatChangeRate, isFlatRate } from '../utils/format'
import styles from './TopStockCard.module.css'

/*
 * 홈 카드의 6주 흐름 그래프. SVG를 직접 그린다.
 *
 * 예전에는 recharts였는데, 상세의 lightweight-charts와 두 벌을 받는 셈이라
 * 이 카드 세 장 때문에 gzip 100KB가 더 들어왔다. 그렇다고 상세 쪽으로 합칠 수도
 * 없었다 — 축·눈금·마우스 조작이 딸린 본격 차트라 눈금도 없는 작은 그림에는 더
 * 번거롭다. 필요한 게 막대 몇 개와 선 두 개뿐이라 직접 그리는 쪽이 짧다.
 *
 * 카드 생김새는 TopStockCard와 이어져야 하므로 CSS는 그쪽 것을 같이 쓴다.
 */

const UP_COLOR = '#f04452'
const DOWN_COLOR = '#3182f6'
/** 보합 글자색. index.css의 --color-text와 같은 값 */
const FLAT_COLOR = '#191f28'
const VOLUME_COLOR = '#eef0f3'
const TREND_COLOR = '#b5bcc4'

/** TopStockCard.module.css의 .chart 높이와 같아야 한다 */
const HEIGHT = 150
const PAD_TOP = 8
const PAD_SIDE = 8

/**
 * 거래량 막대 높이를 그래프의 1/4로 묶는 값. 막대 눈금의 위쪽 끝을 실제 최대
 * 거래량의 4배로 잡아 가장 큰 막대도 아래 1/4에만 머물게 한다.
 */
const VOLUME_HEADROOM = 4

/**
 * 이 요소의 실제 가로 폭. SVG가 좌표를 숫자로 받아서 폭을 알아야 한다.
 * viewBox로 늘리면 선 굵기와 끝점 동그라미까지 같이 찌그러진다.
 */
function useWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (element === null) return

    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return width
}

export default function CardChart({ stock }: { stock: TopStock }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const width = useWidth(boxRef)

  const lineColor = stock.changeRate >= 0 ? UP_COLOR : DOWN_COLOR
  /* 선은 6주 흐름의 방향이라 그대로 두고, 숫자만 보합이면 검게 적는다 */
  const rateColor = isFlatRate(stock.changeRate, 1) ? FLAT_COLOR : lineColor

  return (
    <>
      <p className={styles.rateRow}>
        <span className={styles.rate} style={{ color: rateColor }}>
          {formatChangeRate(stock.changeRate, 1)}
        </span>
        {/* 받아오는 게 30거래일이라 달력으로 약 6주다. home.ts의 loadTopStocks 참고 */}
        <span className={styles.caption}>6주 전 대비</span>
      </p>

      {/* 첫 그림에서는 폭을 모른다. 그때는 빈 칸으로 두고 폭이 정해지면 그린다 */}
      <div className={styles.chart} ref={boxRef}>
        {width > 0 && <Plot stock={stock} width={width} color={lineColor} />}
      </div>
    </>
  )
}

interface PlotProps {
  stock: TopStock
  width: number
  color: string
}

function Plot({ stock, width, color }: PlotProps) {
  const { prices, volumes } = stock
  const lastIndex = prices.length - 1

  const innerWidth = width - PAD_SIDE * 2
  /** 점 하나가 차지하는 가로 폭. 막대도 이 안에 그린다 */
  const band = innerWidth / prices.length

  /* 주가는 받은 값의 최저~최고를 세로 전체에 펼친다. 0부터 그리면 선이 거의 평평해진다 */
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  /* 30일 내내 같은 값이면 0으로 나누게 된다. 그때는 가운데 높이에 눕힌다 */
  const span = max - min || 1

  const maxVolume = Math.max(...volumes) || 1
  const volumeTop = maxVolume * VOLUME_HEADROOM

  /** 값 → 화면 세로 위치. 위가 0이라 큰 값일수록 작은 숫자가 된다 */
  function toY(price: number): number {
    return PAD_TOP + (1 - (price - min) / span) * (HEIGHT - PAD_TOP)
  }

  /** 점 하나의 가로 한가운데 */
  function toX(index: number): number {
    return PAD_SIDE + band * (index + 0.5)
  }

  const priceLine = prices.map((p, i) => `${toX(i)},${toY(p)}`).join(' ')

  return (
    <svg
      width={width}
      height={HEIGHT}
      /* 축도 눈금도 없는 장식이다. 읽어 줄 내용은 위의 등락률 문구가 이미 갖고 있다 */
      aria-hidden="true"
    >
      {/* 거래량. 주가 선 뒤로 깔린다 */}
      {volumes.map((volume, index) => {
        const height = (volume / volumeTop) * HEIGHT
        return (
          <rect
            key={index}
            x={toX(index) - (band * 0.8) / 2}
            y={HEIGHT - height}
            width={band * 0.8}
            height={height}
            fill={VOLUME_COLOR}
          />
        )
      })}

      {/* 6주 동안 어디서 어디로 갔는지만 잇는 점선. 중간의 오르내림은 무시한다 */}
      <line
        x1={toX(0)}
        y1={toY(prices[0])}
        x2={toX(lastIndex)}
        y2={toY(prices[lastIndex])}
        stroke={TREND_COLOR}
        strokeWidth={1}
        strokeDasharray="4 4"
      />

      {/*
        주가. 점을 곧은 선으로 잇는다.
        전에 쓰던 recharts는 부드러운 곡선으로 이었지만, 30개 점이 250px 안에 들어와
        한 칸이 8px 남짓이라 곡선인지 직선인지 눈으로 구분되지 않는다.
      */}
      <polyline
        points={priceLine}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* 어디가 '지금'인지 알려주는 끝점 */}
      <circle
        cx={toX(lastIndex)}
        cy={toY(prices[lastIndex])}
        r={3.5}
        fill="#fff"
        stroke={color}
        strokeWidth={2}
      />
    </svg>
  )
}
