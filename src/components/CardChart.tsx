import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  YAxis,
} from 'recharts'
import type { TopStock } from '../types/stock'
import { formatChangeRate, isFlatRate } from '../utils/format'
import styles from './TopStockCard.module.css'

/*
 * recharts를 쓰는 유일한 파일이라 TopStockCard에서 떼어냈다.
 * 홈은 이 그래프 없이도 표와 카드 껍데기를 먼저 그릴 수 있는데,
 * 같은 파일에 두면 recharts가 홈 첫 묶음에 딸려 들어와 표까지 늦어진다.
 * 부르는 쪽에서 lazy로 가져가고, 오는 동안에는 원래 있던 자리표시자를 그대로 쓴다.
 *
 * 카드 생김새는 TopStockCard와 이어져야 하므로 CSS는 그쪽 것을 같이 쓴다.
 */

const UP_COLOR = '#f04452'
const DOWN_COLOR = '#3182f6'
/** 보합 글자색. index.css의 --color-text와 같은 값 */
const FLAT_COLOR = '#191f28'

export default function CardChart({ stock }: { stock: TopStock }) {
  const lineColor = stock.changeRate >= 0 ? UP_COLOR : DOWN_COLOR
  /* 선은 6주 흐름의 방향이라 그대로 두고, 숫자만 보합이면 검게 적는다 */
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
        {/* 상세 API에 period=ONE_MONTH 로 받는다. home.ts의 loadTopStocks 참고 */}
        <span className={styles.caption}>한 달 전 대비</span>
      </p>

      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
          >
            <YAxis yAxisId="price" hide domain={['dataMin', 'dataMax']} />
            <YAxis yAxisId="volume" hide domain={[0, maxVolume * 4]} />

            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill="#eef0f3"
              isAnimationActive={false}
            />

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
                if (
                  props.index !== lastIndex ||
                  props.cx == null ||
                  props.cy == null
                ) {
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
