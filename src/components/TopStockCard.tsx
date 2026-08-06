import { Link } from 'react-router-dom'
import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  YAxis,
} from 'recharts'
import { prefetchCandles } from '../api/candles'
import type { TopStock, TopTheme } from '../types/stock'
import { formatChangeRate, isFlatRate } from '../utils/format'
import styles from './TopStockCard.module.css'

const UP_COLOR = '#f04452'
const DOWN_COLOR = '#3182f6'
/** 보합 글자색. index.css의 --color-text와 같은 값 */
const FLAT_COLOR = '#191f28'

interface Props {
  theme: TopTheme
  /** 아직 일봉이 안 왔으면 null. 제목만 먼저 그리고 그래프 자리는 비워둔다 */
  stock: TopStock | null
}

/**
 * 카드 껍데기는 테마와 종목명만으로 바로 그린다.
 * 셋 다 기다렸다가 한꺼번에 그리면 화면이 오래 비어 있고, 뒤늦게 나타나며 아래를 밀어낸다.
 */
export default function TopStockCard({ theme, stock }: Props) {
  return (
    <Link
      to={`/stocks/${theme.stockCode}`}
      className={styles.card}
      onMouseEnter={() => prefetchCandles(theme.stockCode)}
    >
      <p className={styles.theme}>{theme.theme}</p>
      <p className={styles.name}>{theme.stockName}</p>

      {stock === null ? <CardPlaceholder /> : <CardChart stock={stock} />}
    </Link>
  )
}

/** 값이 오기 전 자리. 높이를 CardChart와 똑같이 잡아 도착해도 화면이 흔들리지 않는다 */
function CardPlaceholder() {
  return (
    <>
      <p className={styles.rateRow}>
        <span className={`${styles.rate} ${styles.rateEmpty}`}>–</span>
        <span className={styles.caption}>90일 전 대비</span>
      </p>
      <div className={`${styles.chart} ${styles.chartEmpty}`} />
    </>
  )
}

function CardChart({ stock }: { stock: TopStock }) {
  const lineColor = stock.changeRate >= 0 ? UP_COLOR : DOWN_COLOR
  /* 선은 90일 흐름의 방향이라 그대로 두고, 숫자만 보합이면 검게 적는다 */
  const rateColor = isFlatRate(stock.changeRate, 1) ? FLAT_COLOR : lineColor
  const lastIndex = stock.prices.length - 1

  const first = stock.prices[0]
  const last = stock.prices[lastIndex]
  const chartData = stock.prices.map((price, index) => ({
    price,
    volume: stock.volumes[index],
    trend: first + ((last - first) * index) / lastIndex,
  }))

  const maxVolume = Math.max(...stock.volumes)

  return (
    <>
      <p className={styles.rateRow}>
        <span className={styles.rate} style={{ color: rateColor }}>
          {formatChangeRate(stock.changeRate, 1)}
        </span>
        <span className={styles.caption}>90일 전 대비</span>
      </p>

      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <YAxis yAxisId="price" hide domain={['dataMin', 'dataMax']} />
            <YAxis yAxisId="volume" hide domain={[0, maxVolume * 4]} />

            <Bar yAxisId="volume" dataKey="volume" fill="#eef0f3" isAnimationActive={false} />

            <Line
              yAxisId="price"
              dataKey="trend"
              stroke="#b5bcc4"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />

            <Line
              yAxisId="price"
              type="monotone"
              dataKey="price"
              stroke={lineColor}
              strokeWidth={1.8}
              isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; index?: number }) => {
                if (props.index !== lastIndex || props.cx == null || props.cy == null) {
                  return <g key="empty" />
                }
                return (
                  <circle
                    key="last"
                    cx={props.cx}
                    cy={props.cy}
                    r={3.5}
                    fill="#fff"
                    stroke={lineColor}
                    strokeWidth={2}
                  />
                )
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
