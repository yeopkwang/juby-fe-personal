import { Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import Skeleton from './Skeleton'
import { warmOnPress } from '../api/warmup'
import type { TopStock, TopTheme } from '../types/stock'
import styles from './TopStockCard.module.css'

/*
 * 그래프를 홈 첫 묶음에서 뺀다. 어차피 일봉이 오기 전까지는 CardPlaceholder가 떠 있어서,
 * 그 사이에 받아오면 사용자 입장에서 기다림이 늘지 않는다.
 *
 * recharts를 쓰던 때는 이게 gzip 100KB를 미루는 일이라 효과가 컸다. 이제 SVG를 직접
 * 그려서 훨씬 가볍지만, 표를 먼저 그리고 그래프를 뒤에 붙이는 순서 자체는 그대로 둔다.
 */
const CardChart = lazy(() => import('./CardChart'))

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
      /* 누르는 순간 데이터도 부르러 보낸다 — 이유는 api/warmup.ts */
      onPointerDown={(event) => warmOnPress(event, theme.stockCode)}
    >
      <p className={styles.theme}>{theme.theme}</p>
      <p className={styles.name}>{theme.stockName}</p>

      {stock === null ? (
        <CardPlaceholder />
      ) : (
        /* 자리표시자를 그대로 물려줘 그래프가 도착해도 화면이 흔들리지 않는다 */
        <Suspense fallback={<CardPlaceholder />}>
          <CardChart stock={stock} />
        </Suspense>
      )}
    </Link>
  )
}

/** 값이 오기 전 자리. 높이를 CardChart와 똑같이 잡아 도착해도 화면이 흔들리지 않는다 */
function CardPlaceholder() {
  return (
    <>
      <p className={styles.rateRow}>
        <span className={`${styles.rate} ${styles.rateEmpty}`}>–</span>
        <span className={styles.caption}>6주 전 대비</span>
      </p>
      <Skeleton className={`${styles.chart} ${styles.chartEmpty}`} />
    </>
  )
}
