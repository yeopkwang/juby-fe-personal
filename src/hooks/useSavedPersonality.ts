import { useEffect, useState } from 'react'
import { useIsLoggedIn } from './useIsLoggedIn'
import { getMyPersonality } from '../api/member'
import type { PersonalityType } from '../types/personality'

/**
 * 저장된 내 투자성향. 없으면 null.
 *
 * 없는 경우가 셋인데 한 값으로 뭉뚱그린다 — 로그인 안 함 / 로그인했지만 검사 안 함 /
 * 조회 실패. 화면이 할 말이 "테스트하러 가기"로 셋 다 같아서다.
 *
 * 로그인 여부를 미리 보고 거른다. 이 백엔드는 토큰 없이 부르면 401이 아니라 500(NPE)을
 * 주므로, 안 걸러 내면 둘러보던 사람이 콘솔에 서버 오류를 쌓게 된다.
 *
 * 조회 실패를 화면에 알리지 않는 건 성향이 그 화면의 본론이 아니어서다. 백테스트는
 * 성향을 몰라도 돌아가고, 못 받았을 때 결과가 '견주기'에서 '종목 설명'으로 줄어들 뿐이다.
 * 성향 자체가 본론인 마이페이지는 이 훅을 쓰지 않고 실패를 그대로 보여준다.
 */
export function useSavedPersonality(): PersonalityType | null {
  const isLoggedIn = useIsLoggedIn()
  const [personality, setPersonality] = useState<PersonalityType | null>(null)

  useEffect(() => {
    if (!isLoggedIn) {
      setPersonality(null)
      return
    }

    /* 로그아웃하거나 화면을 떠난 뒤에 도착한 응답으로 값을 덮지 않는다 */
    let alive = true

    getMyPersonality()
      .then((info) => {
        if (alive) setPersonality(info?.investPersonality ?? null)
      })
      .catch((error: unknown) => {
        console.warn('내 투자성향 조회 실패', error)
        if (alive) setPersonality(null)
      })

    return () => {
      alive = false
    }
  }, [isLoggedIn])

  return personality
}
