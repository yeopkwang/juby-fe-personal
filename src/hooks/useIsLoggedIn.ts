import { useSyncExternalStore } from 'react'
import { isLoggedIn, subscribeAuth } from '../utils/auth'

/**
 * 지금 로그인 상태인지. 토큰이 생기거나 사라지면 쓰는 화면이 알아서 다시 그려진다.
 *
 * 그릴 때 한 번 읽는 `isLoggedIn()`과 달리 이건 계속 따라간다. 로그인 직후·탈퇴 직후에
 * 페이지를 통째로 새로 받지 않아도 헤더가 바뀌는 이유가 이것이다.
 *
 * 화면이 아닌 곳(api/*.ts, 이벤트 처리 중 한 번 읽기)은 `isLoggedIn()`을 그대로 쓴다.
 */
export function useIsLoggedIn(): boolean {
  return useSyncExternalStore(subscribeAuth, isLoggedIn)
}
