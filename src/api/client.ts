import { clearTokens, getAccessToken, isLoggedIn } from '../utils/auth'

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
  const token = getAccessToken()
  return token === null ? {} : { Authorization: `Bearer ${token}` }
}

interface RequestOptions {
  /**
   * 401을 받아도 로그인 화면으로 보내지 않는다.
   * 로그아웃처럼 어차피 나가는 길이라 튕겨낼 이유가 없는 요청에만 쓴다.
   */
  ignoreUnauthorized?: boolean
}

/**
 * 토큰이 만료되면 서버가 401을 준다. 화면마다 처리하면 다 흩어지므로 여기서 한 번에 끝낸다.
 * client.ts는 컴포넌트가 아니라 navigate()를 쓸 수 없고,
 * 헤더가 로그인 상태를 다시 읽어야 하므로 주소창을 통째로 바꾸는 편이 맞다.
 */
function redirectToLogin(): void {
  // 이미 로그인 화면이면 보낼 곳이 없다. 여기서 401이 또 나면 무한히 새로고침한다
  if (window.location.pathname === '/login') {
    return
  }
  // 토큰 없이 보낸 요청의 401은 '만료'가 아니다. 둘러보던 사람을 끌고 가면 안 된다
  if (!isLoggedIn()) {
    return
  }

  clearTokens()
  window.location.href = '/login'
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  options?: RequestOptions,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    // 토큰 헤더는 항상 붙이고, 호출부가 더 넣고 싶은 헤더는 뒤에 합친다
    headers: { ...authHeaders(), ...init?.headers },
  })
  if (response.status === 401 && options?.ignoreUnauthorized !== true) {
    redirectToLogin()
  }
  if (!response.ok) {
    throw new Error(`요청 실패 (${response.status}) ${path}`)
  }
  return (await response.json()) as T
}

/** { isSuccess, result } 래퍼를 벗긴다. 실패 코드는 서버가 준 message로 던진다 */
function unwrap<T>(body: ApiResponse<T>): T {
  if (!body.isSuccess) {
    throw new Error(body.message)
  }
  return body.result
}

/** MarketController 계열: 공통 래퍼 없이 데이터가 그대로 내려온다 */
export function getRaw<T>(path: string): Promise<T> {
  return requestJson<T>(path)
}

/** 그 외: { isSuccess, result } 래퍼를 벗겨 result만 반환한다 */
export async function get<T>(path: string): Promise<T> {
  return unwrap(await requestJson<ApiResponse<T>>(path))
}

/**
 * 서버에 값을 보낼 때 쓴다. GET과 다른 점은 두 가지뿐이다.
 * 보낼 내용을 JSON 문자열로 바꾸고, 그게 JSON이라고 Content-Type으로 알려준다.
 */
export async function post<T>(
  path: string,
  body: unknown,
  options?: RequestOptions,
): Promise<T> {
  return unwrap(
    await requestJson<ApiResponse<T>>(
      path,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      options,
    ),
  )
}
