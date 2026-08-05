/**
 * 공통 fetch 래퍼. baseURL과 토큰 헤더를 여기서만 관리한다.
 * 개발 중에는 빈 문자열 → vite.config.ts의 프록시가 백엔드로 넘긴다(CORS 우회).
 */
const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? ''

interface ApiResponse<T> {
  isSuccess: boolean
  code: string
  message: string
  result: T
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('accessToken')
  return token === null ? {} : { Authorization: `Bearer ${token}` }
}

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() })
  if (!response.ok) {
    throw new Error(`요청 실패 (${response.status}) ${path}`)
  }
  return (await response.json()) as T
}

/** MarketController 계열: 공통 래퍼 없이 데이터가 그대로 내려온다 */
export function getRaw<T>(path: string): Promise<T> {
  return requestJson<T>(path)
}

/** 그 외: { isSuccess, result } 래퍼를 벗겨 result만 반환한다 */
export async function get<T>(path: string): Promise<T> {
  const body = await requestJson<ApiResponse<T>>(path)
  if (!body.isSuccess) {
    throw new Error(body.message)
  }
  return body.result
}
