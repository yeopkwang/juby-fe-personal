/**
 * 토큰을 다루는 유일한 곳.
 * localStorage는 XSS에 취약해서 언젠가 HttpOnly 쿠키로 옮길 수 있는데,
 * 접근이 이 파일에만 있으면 그때 이 파일만 고치면 된다.
 */
const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'

/**
 * 로그인 상태가 바뀌었을 때 알려줄 곳들.
 *
 * localStorage는 값이 바뀌어도 아무에게도 알려주지 않는다. 그래서 헤더는 그려질 때
 * 한 번 읽고 마는 수밖에 없었고, 로그인·로그아웃 뒤에 우측 메뉴를 바꾸려고
 * **페이지를 통째로 새로 고쳤다**(window.location.href = '/').
 * 화면이 하얗게 번쩍이고, 받아둔 시세와 캔들 캐시가 전부 날아가고,
 * React 라우터를 쓰는 의미도 없어진다.
 *
 * 알림을 여기서 직접 낸다. 토큰이 이 파일 안에서만 바뀌므로 놓칠 곳이 없다.
 */
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

/**
 * 로그인 상태가 바뀌면 불러 준다. 되돌려주는 함수를 부르면 그만 듣는다.
 *
 * storage 이벤트도 함께 듣는다. 이건 **다른 탭에서** localStorage를 건드렸을 때만 온다
 * (같은 탭에서는 안 온다 — 그래서 위의 notify가 따로 필요하다).
 * 한쪽 탭에서 로그아웃했는데 다른 탭이 계속 로그인한 척하고 있으면 안 된다.
 */
export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener)

  function onStorage(event: StorageEvent) {
    // 토큰과 상관없는 키가 바뀐 것까지 반응할 이유는 없다
    if (event.key === ACCESS_TOKEN_KEY || event.key === null) listener()
  }
  window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

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
