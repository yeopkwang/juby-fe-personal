import { Link, Navigate, useLocation } from 'react-router-dom'
import PersonalityCard from '../components/PersonalityCard'
import type { PersonalityResult } from '../types/personality'
import styles from './PersonalityResultPage.module.css'

/** 검사를 마친 뒤 돌아갈 곳. 들어온 문에 따라 달라진다 */
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
        {/*
          예전에는 a였다. 검사가 personality.html이라는 별도 페이지에 떨어져 있어서
          완료를 누르면 그 페이지를 아예 떠나야 했기 때문이다.
          이제 같은 앱 안이라 Link로 옮기면 되고, 화면이 하얗게 번쩍이지 않는다.
        */}
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

      {/*
        저장됐는지를 말해 준다. 로그인해서 검사하면 서버가 채점하며 함께 저장하지만,
        비로그인은 화면에서만 매기고 끝난다. 이 줄이 없으면 "검사했는데 마이페이지에
        없다"고 헤매게 된다. 저장된 경우엔 굳이 말하지 않는다 — 당연한 일이라 군더더기다.
      */}
      {!result.saved && (
        <p className={styles.notice}>
          로그인하면 이 결과가 저장돼서 마이페이지와 백테스트에서도 쓸 수 있어요.
        </p>
      )}
    </>
  )
}
