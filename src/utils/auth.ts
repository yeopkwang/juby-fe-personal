/**
 * 토큰을 다루는 유일한 곳.
 * localStorage는 XSS에 취약해서 언젠가 HttpOnly 쿠키로 옮길 수 있는데,
 * 접근이 이 파일에만 있으면 그때 이 파일만 고치면 된다.
 */
const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'

export function saveTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
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
