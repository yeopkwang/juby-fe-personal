import { useSyncExternalStore } from 'react'
import { isLoggedIn, subscribeAuth } from '../utils/auth'

/**
 * 지금 로그인 상태인지. 토큰이 생기거나 사라지면 **쓰는 화면이 알아서 다시 그려진다.**
 *
 * `isLoggedIn()`을 그냥 부르면 그리는 순간의 값을 한 번 읽고 끝이라, 그 뒤에 로그인해도
 * 화면은 모른다. 그래서 예전에는 로그인·로그아웃 뒤에 페이지를 통째로 새로 고쳤다.
 * 이 훅을 쓰면 새로 고칠 필요가 없다.
 *
 * `useState` + `useEffect`로 흉내 내지 않고 `useSyncExternalStore`를 쓰는 이유:
 * React 밖에서 값이 바뀌는 경우(다른 탭의 로그아웃, client.ts의 401 처리)를 위해
 * React가 따로 마련해 둔 창구다. effect로 하면 첫 그림과 실제 값이 어긋나는
 * 찰나가 생겨서, 로그인한 사람에게 '로그인' 메뉴가 한 번 깜빡였다 바뀐다.
 *
 * 두 번째 인자가 스냅샷을 읽는 함수인데, **매번 같은 값이면 같은 것으로 봐야 한다.**
 * boolean이라 그 조건이 저절로 만족된다(객체를 새로 만들어 돌려주면 무한히 다시 그린다).
 */
export function useIsLoggedIn(): boolean {
  return useSyncExternalStore(subscribeAuth, isLoggedIn, () => false)
}
