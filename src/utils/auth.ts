/**
 * 토큰을 다루는 유일한 곳.
 * localStorage는 XSS에 취약해서 언젠가 HttpOnly 쿠키로 옮길 수 있는데,
 * 접근이 이 파일에만 있으면 그때 이 파일만 고치면 된다.
 *
 * 로그인 여부가 바뀌면 구독자에게 알린다(subscribeAuth). 예전에는 알릴 곳이 없어
 * 로그인·탈퇴·토큰 만료 때마다 페이지를 통째로 새로 받아야 헤더가 갱신됐다.
 */
const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'

/** 로그인 여부가 바뀌면 다시 그려야 하는 화면들 */
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

/**
 * 로그인 여부 변화를 구독한다. `useIsLoggedIn`이 이걸 쓴다.
 * 돌려주는 함수를 부르면 구독이 끊긴다.
 */
export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/*
 * 다른 탭에서 로그인하거나 나가면 이 탭도 따라 바뀐다.
 * storage 이벤트는 값을 바꾼 탭 자신에게는 오지 않으므로 위 notify와 겹치지 않는다.
 * key가 null인 경우는 localStorage 전체를 비운 것이다.
 */
window.addEventListener('storage', (event) => {
  if (event.key === ACCESS_TOKEN_KEY || event.key === null) notify()
})

export function saveTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  notify()
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  notify()
}

/** 요청 헤더에 실을 토큰. client.ts가 쓴다 */
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

/** 로그아웃 요청 본문에 실을 토큰 (STEP 4) */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function isLoggedIn(): boolean {
  return getAccessToken() !== null
}
