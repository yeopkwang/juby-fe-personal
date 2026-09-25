import { Link } from 'react-router-dom'
import CardChart from './CardChart'
import { toPreviewState } from '../utils/stockPreview'
import type { CardFailure, TopStock, TopTheme } from '../types/stock'
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
  /**
   * 못 채운 이유. stock이 null인데 이 값이 있으면 오는 중이 아니라 끝난 것이다.
   * 로딩 자리표시와 같은 모양으로 두면 실패인지, 값이 없는지, 아직 오는지 구분되지 않는다.
   */
  failure?: CardFailure | null
}

/**
 * 카드 껍데기는 테마와 종목명만으로 바로 그린다.
 * 셋 다 기다렸다가 한꺼번에 그리면 화면이 오래 비어 있고, 뒤늦게 나타나며 아래를 밀어낸다.
 */
export default function TopStockCard({ theme, stock, failure = null }: Props) {
  return (
    <Link
      to={`/stocks/${theme.stockCode}`}
      // 카드에는 기준일 종가가 없어 이름만 싣는다. 가격 자리는 상세 화면이 뼈대로 둔다
      state={toPreviewState({ stockCode: theme.stockCode, stockName: theme.stockName })}
      className={styles.card}
    >
      <p className={styles.theme}>{theme.theme}</p>
      <p className={styles.name}>{theme.stockName}</p>

      {stock !== null ? (
        <CardChart stock={stock} />
      ) : failure !== null ? (
        <CardFailed reason={failure} />
      ) : (
        <CardPlaceholder />
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
        <span className={styles.caption}>한 달 전 대비</span>
      </p>
      <div className={`${styles.chart} ${styles.chartEmpty}`} />
    </>
  )
}

/** 못 채운 카드. 높이는 자리표시와 같게 두되 반짝이지 않고 이유를 적는다 */
function CardFailed({ reason }: { reason: CardFailure }) {
  return (
    <>
      <p className={styles.rateRow}>
        <span className={`${styles.rate} ${styles.rateEmpty}`}>–</span>
        <span className={styles.caption}>한 달 전 대비</span>
      </p>
      <div className={`${styles.chart} ${styles.chartMessage}`}>
        {reason === 'error' ? '불러오지 못했어요' : '표시할 값이 없어요'}
      </div>
    </>
  )
}
