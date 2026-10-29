import { useEffect, useState } from 'react'
import { INDEX_REFRESH_MS, isMarketHours, loadMarketIndices, readCachedIndices } from '../api/market'
import { toKoreanDateTime } from '../utils/date'
import { formatChangeRate, formatPoint, formatPointChange, isFiniteNumber, isFlatRate } from '../utils/format'
import type { MarketIndex, MarketIndices } from '../types/market'
import styles from './MarketIndexBar.module.css'

/**
 * 화면 아래에 붙는 국내 지수 띠(코스피·코스닥). 토스증권 아래 띠를 본떴다(2026-10-29 사용자 요청).
 *
 * App의 Layout에 한 번 놓여 화면을 옮겨도 다시 그려지지 않는다 — 옮길 때마다 서버에 묻지 않는다.
 * 처음 한 번 묻고, 장중(평일 9:00~15:35)이면서 탭이 보일 때만 1분마다 다시 묻는다. 무엇을 언제 묻는지는 api/market.ts가 정한다.
 * 보여줄 값이 없으면(못 받았고 지난 값도 없음) 띠를 그리지 않는다.
 */
export default function MarketIndexBar() {
  const [data, setData] = useState<MarketIndices | null>(readCachedIndices)
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    let isStale = false
    const refresh = () => {
      void loadMarketIndices().then((next) => {
        if (isStale) return
        setSettled(true)
        // 못 받았으면 지난 값이 온다. 그것도 없으면 지금 보이는 값을 지우지 않는다
        if (next !== null) setData(next)
      })
    }

    refresh()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && isMarketHours()) refresh()
    }, INDEX_REFRESH_MS)
    return () => {
      isStale = true
      clearInterval(timer)
    }
  }, [])

  if (data === null) {
    // 처음 받는 동안은 띠 자리만 잡아 둔다. 못 받았으면 띠째 뺀다
    return settled ? null : (
      <div className={styles.bar} aria-hidden="true">
        <div className={styles.inner} />
      </div>
    )
  }

  const asOf = toKoreanDateTime(data.receivedAt)
  return (
    <aside className={styles.bar} aria-label="국내 지수">
      <div className={styles.inner}>
        <p className={styles.label}>국내 지수</p>
        <ul className={styles.list}>
          {data.indices.map((index) => (
            <IndexItem key={index.code} index={index} />
          ))}
        </ul>
        {data.isSample ? (
          <p className={styles.sample}>
            예시 값<span className={styles.wideOnly}> · 실제 지수 아님</span>
          </p>
        ) : (
          asOf !== '' && <p className={styles.asOf}>{asOf} 기준</p>
        )}
      </div>
    </aside>
  )
}

function IndexItem({ index }: { index: MarketIndex }) {
  return (
    <li className={styles.item}>
      <span className={styles.name}>{index.name}</span>
      <span className={styles.value}>{formatPoint(index.value)}</span>
      {(index.change !== null || index.changeRate !== null) && (
        <span className={toneClass(index)}>
          {index.change !== null && <span className={styles.change}>{formatPointChange(index.change)}</span>}
          {index.changeRate !== null && <span className={styles.rate}>{formatChangeRate(index.changeRate)}</span>}
        </span>
      )}
    </li>
  )
}

/** 오르면 빨강, 내리면 파랑, 보합은 색 없음. 대비율이 없으면 대비(포인트)의 부호로 가른다 */
function toneClass(index: MarketIndex): string {
  const basis = index.changeRate ?? index.change
  if (!isFiniteNumber(basis) || isFlatRate(basis)) return `${styles.tone} ${styles.flat}`
  return `${styles.tone} ${basis > 0 ? styles.up : styles.down}`
}
