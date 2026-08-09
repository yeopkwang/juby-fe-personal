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

/**
 * ⛔ 백엔드 호출 전면 차단 스위치.
 *
 * 백엔드가 한국투자증권(KIS) API를 중계하는 구조라, 프론트가 화면을 열 때마다
 * 그쪽으로 요청이 흘러간다. 홈 한 번이 100건이 넘어서 증권사 계정이 정지될 수 있다는
 * 경고를 받아 전부 막아 둔다.
 *
 * **여기 한 곳만 막으면 된다.** 이 파일의 fetch가 앱 전체에서 유일한 통신 창구다.
 * 화면·API 모듈은 전부 이 아래를 거치므로 호출부를 하나씩 주석 처리할 필요가 없고,
 * 그렇게 해야 새로 추가되는 코드까지 자동으로 막힌다(빠뜨릴 곳이 없다).
 *
 * 막힌 요청은 '실패'로 떨어진다. 화면들은 이미 실패를 다루게 되어 있어서
 * 홈은 저장해 둔 지난 시세로, 나머지는 각자의 에러 안내로 넘어간다.
 *
 * 다시 켜려면 이 값을 false로 바꾼다. 함께 막아 둔 두 곳도 같이 되돌려야 한다.
 *   1. src/pages/LoginPage.tsx  — 소셜 로그인 이동(백엔드로 주소창을 옮긴다)
 *   2. vite.config.ts           — server.proxy(개발 중 /api를 백엔드로 넘긴다)
 */
const API_DISABLED = true

/**
 * 응답을 이만큼 기다려도 안 오면 실패로 친다.
 *
 * fetch는 기본적으로 기다리는 시간에 제한이 없다. 백엔드가 멈춰 서면(응답도 거절도 안 하면)
 * 화면은 로딩 자리 그대로 영원히 앉아 있고, 실패했을 때 쓰라고 만들어 둔 대체 값도
 * 영영 쓰이지 않는다. 실제로 서버가 죽었을 때 홈이 통째로 '-'가 되는 걸 이 방식으로 겪었다.
 *
 * 12초는 가장 느린 요청(일봉 1.5~2.4초)에 맞춘 값이다. 빠른 API를 부르는 쪽은
 * timeoutMs로 훨씬 짧게 잡는다 — 56ms짜리를 12초씩 기다릴 이유가 없다.
 */
const DEFAULT_TIMEOUT = 12_000

/**
 * 서버가 통째로 응답을 멈췄을 때 요청마다 제한 시간을 다 채우지 않게 하는 차단기.
 *
 * 서버가 죽는 방식이 두 가지인데 체감이 전혀 다르다. 연결을 거절(RST)하면 fetch가
 * 즉시 실패하지만, 들어온 연결을 그냥 삼키면(SYN 드롭) 제한 시간까지 매달린다.
 * 실제로 겪은 건 후자였고, 그때 홈 카드 한 장이 실패를 확정하는 데만 36초가 걸렸다.
 * 재시도까지 겹치면 102종목 표는 몇 분씩 회색으로 남는다.
 *
 * 연달아 무응답이면 서버가 아픈 것이지 이 요청만의 문제가 아니다.
 * 잠시 아예 보내지 않고 즉시 실패시켜서, 화면이 대체 값으로 빨리 넘어가게 한다.
 *
 * 응답이 오기만 하면(500이어도) 서버는 살아 있는 것이므로 바로 되돌린다.
 * 호출 제한으로 인한 500은 재시도로 복구되는 정상 흐름이라 차단기를 건드리면 안 된다.
 * 그래서 문턱이 두 번으로 낮아도 괜찮다 — 여기 걸리는 건 '아예 안 오는' 경우뿐이고,
 * 56ms짜리 요청이 3.5초를 두 번 연달아 넘겼다면 다시 물어도 답은 같다.
 */
const BREAKER_THRESHOLD = 2
const BREAKER_COOLDOWN = 15_000

let deadStreak = 0
let breakerUntil = 0

/**
 * 식은 뒤에는 저절로 한 건이 통과한다. 그게 성공하면 아래 resetBreaker가 풀고,
 * 또 실패하면 여기서 다시 잠긴다. 따로 상태를 둘 필요가 없다.
 */
function tripBreaker(): void {
  deadStreak += 1
  if (deadStreak >= BREAKER_THRESHOLD) {
    breakerUntil = Date.now() + BREAKER_COOLDOWN
  }
}

function resetBreaker(): void {
  deadStreak = 0
  breakerUntil = 0
}

interface RequestOptions {
  /**
   * 401을 받아도 로그인 화면으로 보내지 않는다.
   * 로그아웃처럼 어차피 나가는 길이라 튕겨낼 이유가 없는 요청에만 쓴다.
   */
  ignoreUnauthorized?: boolean
  /** 이 요청만 다른 제한 시간을 쓴다(ms) */
  timeoutMs?: number
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
  /*
   * 무엇보다 먼저 확인한다. 아래 어떤 경로로도 fetch에 닿지 못하게 여기서 끊는다.
   * 증권사 계정 보호를 위한 조치라 실수로 새어 나가면 안 된다.
   */
  if (API_DISABLED) {
    throw new Error(
      `백엔드 호출이 차단되어 있습니다 (src/api/client.ts의 API_DISABLED) ${path}`,
    )
  }

  // 방금 전까지 연달아 무응답이었다. 보내봐야 제한 시간만 태운다
  if (Date.now() < breakerUntil) {
    throw new Error(`서버 무응답 상태 ${path}`)
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      // 토큰 헤더는 항상 붙이고, 호출부가 더 넣고 싶은 헤더는 뒤에 합친다
      headers: { ...authHeaders(), ...init?.headers },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error: unknown) {
    // 제한 시간 초과든 연결 실패든 '서버에 닿지 못했다'는 점은 같다
    tripBreaker()
    /*
     * 제한 시간을 넘기면 TimeoutError로 온다. 부르는 쪽은 '왜 실패했는지'가 아니라
     * '실패했다'만 알면 되므로, 서버가 안 뜬 경우와 같은 모양의 에러로 맞춰 던진다.
     */
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error(`응답 없음 (${timeoutMs}ms 초과) ${path}`)
    }
    throw error
  }

  // 상태 코드가 무엇이든 응답이 왔다는 건 서버가 살아 있다는 뜻이다
  resetBreaker()

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
export function getRaw<T>(path: string, options?: RequestOptions): Promise<T> {
  return requestJson<T>(path, undefined, options)
}

/** 그 외: { isSuccess, result } 래퍼를 벗겨 result만 반환한다 */
export async function get<T>(path: string): Promise<T> {
  return unwrap(await requestJson<ApiResponse<T>>(path))
}

/** 서버 자원을 지운다. 본문 없이 경로만 보낸다 */
export async function remove<T>(
  path: string,
  options?: RequestOptions,
): Promise<T> {
  return unwrap(
    await requestJson<ApiResponse<T>>(path, { method: 'DELETE' }, options),
  )
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
