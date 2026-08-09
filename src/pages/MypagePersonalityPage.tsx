import { useCallback, useEffect, useState } from 'react'
import PersonalityCard from '../components/PersonalityCard'
import { getMyPersonality } from '../api/member'
import { PERSONALITY_INFO } from '../utils/personality'
import type { PersonalityInfo } from '../types/member'
import styles from './MypagePersonalityPage.module.css'

/**
 * 성향검사는 personality.html에 따로 떨어져 있어 절대경로로 나간다.
 * 검사를 마치면 PersonalityResultPage의 doneRoute가 from=mypage를 보고 여기로 돌려보낸다.
 */
const TEST_URL = '/personality.html?from=mypage'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; info: PersonalityInfo }
  /** 아직 검사하지 않은 회원 */
  | { kind: 'none' }
  | { kind: 'error' }

export default function MypagePersonalityPage() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  const load = useCallback(() => {
    setState({ kind: 'loading' })

    getMyPersonality()
      .then((info) =>
        setState(info === null ? { kind: 'none' } : { kind: 'ready', info }),
      )
      .catch((error: unknown) => {
        console.warn('투자성향 조회 실패', error)
        setState({ kind: 'error' })
      })
  }, [])

  useEffect(load, [load])

  if (state.kind === 'loading') {
    return <div className={styles.skeleton} aria-label="불러오는 중" />
  }

  if (state.kind === 'error') {
    return (
      <div className={styles.message}>
        <p className={styles.messageText}>투자성향을 불러오지 못했습니다.</p>
        {/*
          백엔드가 /api/**를 permitAll로 열어둬서 인증이 풀려도 401이 아니라 500이 온다.
          로그인 화면으로 튕겨내는 대신 다시 로그인하라고 알려만 준다.
        */}
        <p className={styles.hint}>
          로그인이 풀렸을 수 있어요. 문제가 계속되면 다시 로그인해 주세요.
        </p>
        <button type="button" className={styles.primary} onClick={load}>
          다시 시도
        </button>
      </div>
    )
  }

  if (state.kind === 'none') {
    return (
      <div className={styles.message}>
        <p className={styles.messageText}>아직 투자성향 검사를 하지 않았습니다</p>
        <p className={styles.hint}>
          일곱 문항이면 끝나요. 검사하고 나면 여기에 결과가 남습니다.
        </p>
        <a className={styles.primary} href={TEST_URL}>
          검사하러 가기
        </a>
      </div>
    )
  }

  const { info } = state
  /* 서버 값이 먼저다. personality 테이블이 비어 있으면 빈 문자열이 오므로 로컬 문구로 받친다 */
  const fallback = PERSONALITY_INFO[info.investPersonality]

  return (
    <PersonalityCard
      type={info.investPersonality}
      description={info.description || fallback.description}
      imageUrl={info.personalityImg || fallback.imageUrl}
    >
      {/* Link가 아니라 a인 이유: 검사가 personality.html에 따로 있어 이 앱을 떠나야 한다 */}
      <a href={TEST_URL} className={styles.retest}>
        검사 다시하기
      </a>
    </PersonalityCard>
  )
}
