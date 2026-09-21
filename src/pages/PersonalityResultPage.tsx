import { Link, Navigate, useLocation } from 'react-router-dom'
import PersonalityCard from '../components/PersonalityCard'
import type { PersonalityResult } from '../types/personality'
import styles from './PersonalityResultPage.module.css'

/** 검사를 마친 뒤 돌아갈 곳. 들어온 문(?from=)에 따라 달라진다 */
function doneRoute(from: string | null): string {
  if (from === 'mypage') return '/mypage/personality'
  // AI 주가분석의 '투자성향 변경하기'로 들어온 경우. 하던 자리로 돌려보낸다
  if (from === 'ai') return '/ai'
  return '/'
}

export default function PersonalityResultPage() {
  const location = useLocation()
  const result = (location.state as { result?: PersonalityResult } | null)?.result
  const from = new URLSearchParams(location.search).get('from')

  /*
   * 결과는 문항 화면이 navigate로 들고 온다. 주소창에 직접 쳐서 들어오면 보여줄 게 없다.
   * replace를 쓰는 이유는 뒤로 가기를 눌렀을 때 다시 여기로 튕겨 오지 않게 하기 위해서다.
   */
  if (result === undefined) {
    return (
      <Navigate
        to={{ pathname: '/personality-test', search: location.search }}
        replace
      />
    )
  }

  return (
    <>
      <h1 className={styles.title}>나의 투자성향 테스트</h1>

      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={100}
      >
        <div className={styles.progressFill} />
      </div>

      <PersonalityCard
        type={result.type}
        description={result.description}
        imageUrl={result.imageUrl}
      >
        <Link to={doneRoute(from)} className={styles.done}>
          완료
        </Link>
        {/* 다시 풀 때도 들어온 문을 유지해야 끝나고 같은 자리로 돌아간다 */}
        <Link
          to={{ pathname: '/personality-test', search: location.search }}
          className={styles.retry}
        >
          검사 다시하기
        </Link>
      </PersonalityCard>
    </>
  )
}
