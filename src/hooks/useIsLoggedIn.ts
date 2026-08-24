import { useSyncExternalStore } from 'react'
import { isLoggedIn, subscribeAuth } from '../utils/auth'

/**
 * 지금 로그인 상태인지. 토큰이 생기거나 사라지면 쓰는 화면이 알아서 다시 그려진다.
 *
 * useSyncExternalStore를 쓰는 건 React 밖에서 값이 바뀌기 때문이다(다른 탭의 로그아웃,
 * client.ts의 401 처리). effect로 흉내 내면 첫 그림과 실제 값이 어긋나는 찰나가 생겨
 * 로그인한 사람에게 '로그인' 메뉴가 한 번 깜빡였다 바뀐다.
 */
export function useIsLoggedIn(): boolean {
  return useSyncExternalStore(subscribeAuth, isLoggedIn, () => false)
}
