import { Link } from 'react-router-dom'
import CardChart from './CardChart'
import type { TopStock, TopTheme } from '../types/stock'
import styles from './TopStockCard.module.css'

/*
 * 예전에는 CardChart를 lazy로 따로 받았다. recharts(압축 97KB)가 딸려 들어와
 * 홈 첫 묶음이 통째로 늦어졌기 때문이다. 2026-09-21에 그래프를 직접 그리면서
 * 몇 KB로 줄어, 따로 받느라 요청을 한 번 더 하는 쪽이 오히려 손해가 됐다.
 */

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
    <Link to={`/stocks/${theme.stockCode}`} className={styles.card}>
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
        <span className={styles.caption}>한 달 전 대비</span>
      </p>
      <div className={`${styles.chart} ${styles.chartEmpty}`} />
    </>
  )
}
