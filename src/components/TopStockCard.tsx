import { Link } from 'react-router-dom'
import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  YAxis,
} from 'recharts'
import type { TopStock } from '../types/stock'
import { formatChangeRate } from '../utils/format'
import styles from './TopStockCard.module.css'

const UP_COLOR = '#f04452'
const DOWN_COLOR = '#3182f6'

interface Props {
  stock: TopStock
}

export default function TopStockCard({ stock }: Props) {
  const isUp = stock.changeRate >= 0
  const lineColor = isUp ? UP_COLOR : DOWN_COLOR
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
    <Link to={`/stocks/${stock.stockCode}`} className={styles.card}>
      <p className={styles.theme}>{stock.theme}</p>
      <p className={styles.name}>{stock.stockName}</p>

      <p className={styles.rateRow}>
        <span className={styles.rate} style={{ color: lineColor }}>
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
    </Link>
  )
}
