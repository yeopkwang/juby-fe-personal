import { clearTokens, getAccessToken, isLoggedIn } from '../utils/auth'
import {
  ApiError,
  BlockedPathError,
  NoResponseError,
  UserFacingError,
} from '../utils/error'

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
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * ✅ 나갈 수 있는 경로 목록. 여기 없으면 못 나간다.
 *
 * 막는 목록이 아니라 허용 목록인 것이 핵심이다. 막는 목록은 빠뜨리면 그 경로가 조용히
 * 뚫리지만, 허용 목록은 빠뜨려도 안 나갈 뿐이라 화면이 바로 실패해서 눈에 띈다.
 * 잘못될 방향이 안전한 쪽인 구조를 고른 것이다.
 *
 * 기준은 팀 노션의 '완료' 표다. 스웨거에는 개발 중인 것까지 올라와 있어서
 * 그걸 보고 붙였다가 백엔드가 만들지도 않은 API를 부른 적이 있다.
 *
 * 빠져 있는 것들: `/api/market/**`·`/api/token`·`/api/initiate`(KIS 중계, 계정 정지
 * 경고를 받은 그 경로), `/api/news`(네이버 중계, 관련도 정렬이 없었다),
 * `/api/open-ai/ask`·`/v1/ai/**`(AI 표에 행이 없다), `/api/guides`(노션에서 확인 못 함),
 * `/v1/auth/logout`(인증 API, 프론트가 안 건드리기로 했다).
 * KIS 경로는 노션에 완료로 있어도 여기 적으면 안 된다.
 *
 * 다만 기준은 'KIS를 거치는가'가 아니라 '몰아치는가'다. `/api/stocks/{code}`는 KIS를
 * 1건 부르지만 허용했다 — 경고를 부른 건 홈이 102종목을 몰아쳐 108건을 만든 것이었다.
 */
const ALLOWED_PREFIXES = [
  /* 백테스트 — 프리셋·기간 옵션. 백엔드 자기 DB만 읽는다 */
  '/api/backtest',
  /* 성향테스트 문항 조회·결과 제출 */
  '/api/personality-tests',
  /* 내 정보 조회·수정·탈퇴, 내 투자성향 조회·변경 */
  '/api/members/me',
  /*
   * 종목 상세 — OHLCV(백엔드 daily_price), 종목별 뉴스(Pinecone).
   * 현재가·전일대비만 KIS인데 종목 하나당 1건이라 홈의 몰아치기와 성격이 다르다.
   */
  '/api/stocks',
]

function isAllowed(path: string): boolean {
  return ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))
}

/**
 * 응답을 이만큼 기다려도 안 오면 실패로 친다.
 *
 * fetch는 기다리는 시간에 제한이 없어서, 백엔드가 응답도 거절도 안 하면 화면이 로딩
 * 자리에 영원히 앉는다(서버가 죽었을 때 실제로 겪었다).
 *
 * 12초는 '가장 느린 요청에 맞춘 값'이 아니라 **아직 재보지 못한 창구용 그물**이다.
 * 원래 근거였던 기간 지정 일봉(건당 1.5~2.4초)은 2026-08-19에 지워졌다. 지금 남은 것 중
 * 재본 것은 전부 FAST_TIMEOUT을 쓰고, 여기 걸리는 건 회원 API처럼 로그인이 막혀 있어
 * 실측을 못 한 것들뿐이다. 그것들을 재고 나면 이 값도 내릴 수 있다.
 */
const DEFAULT_TIMEOUT = 12_000

/**
 * 백엔드가 자기 DB만 읽는 창구용 제한 시간.
 *
 * 2026-08-25 실측(개발 프록시 경유): 백테스트 프리셋 16~38ms, 프리셋 옵션 34ms,
 * 종목 상세 38~86ms(가장 큰 ALL 응답이 45KB), 성향 문항 51ms.
 * 느린 회선에서 45KB를 받는 시간을 넉넉히 얹어도 1~2초라 3.5초면 오해할 일이 없고,
 * 서버가 멈췄을 때 12초 대신 3.5초 만에 실패로 돌아선다.
 *
 * ⚠️ 재본 창구에만 붙인다. 종목 뉴스는 Pinecone(벡터DB)이라 성격이 다르고 지금 502라
 * 정상일 때가 얼마인지 모른다 — 그런 자리에 이 값을 붙이면 멀쩡한 응답을 끊게 된다.
 */
export const FAST_TIMEOUT = 3_500

/**
 * 서버가 통째로 응답을 멈췄을 때 요청마다 제한 시간을 다 채우지 않게 하는 차단기.
 *
 * 연결을 거절(RST)하면 fetch가 즉시 실패하지만, 들어온 연결을 삼키면(SYN 드롭)
 * 제한 시간까지 매달린다. 실제로 겪은 건 후자였고 홈 카드 한 장이 실패를 확정하는 데만
 * 36초가 걸렸다. 재시도까지 겹치면 102종목 표는 몇 분씩 회색으로 남는다.
 *
 * 응답이 오기만 하면(500이어도) 서버는 살아 있으므로 바로 되돌린다. 호출 제한으로 인한
 * 500은 재시도로 복구되는 정상 흐름이라 차단기를 건드리면 안 된다. 그래서 문턱이 둘이어도
 * 괜찮다 — 여기 걸리는 건 '아예 안 오는' 경우뿐이다.
 */
const BREAKER_THRESHOLD = 2
const BREAKER_COOLDOWN = 15_000

let deadStreak = 0
let breakerUntil = 0

/** 식은 뒤 한 건이 저절로 통과한다. 성공하면 resetBreaker가 풀고 실패하면 여기서 다시 잠근다 */
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
  /** 401을 받아도 로그인 화면으로 보내지 않는다. 로그아웃처럼 어차피 나가는 길에 쓴다 */
  ignoreUnauthorized?: boolean
  /** 이 요청만 다른 제한 시간을 쓴다(ms) */
  timeoutMs?: number
}

/**
 * 401을 화면마다 처리하면 흩어지므로 여기서 한 번에 끝낸다.
 * 컴포넌트가 아니라 navigate()를 쓸 수 없고, 헤더가 로그인 상태를 다시 읽어야 한다.
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

/** 실패 응답에서 코드만 꺼낸다. 본문이 JSON이 아닐 수 있고 그건 오류가 아니다 */
async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null && 'code' in body) {
      const { code } = body as { code: unknown }
      return typeof code === 'string' ? code : null
    }
  } catch {
    /* 본문을 읽지 못했다. status만 들고 간다 */
  }
  return null
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  options?: RequestOptions,
): Promise<T> {
  // 무엇보다 먼저 확인한다. 증권사 계정 보호라 실수로 새어 나가면 안 된다
  if (!isAllowed(path)) {
    throw new BlockedPathError(
      `허용 목록에 없는 경로입니다 (src/api/client.ts의 ALLOWED_PREFIXES) ${path}`,
    )
  }

  // 방금 전까지 연달아 무응답이었다. 보내봐야 제한 시간만 태운다
  if (Date.now() < breakerUntil) {
    throw new NoResponseError(`서버 무응답 상태 ${path}`)
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
    // 시간 초과는 TimeoutError, 서버가 안 떠 있으면 TypeError로 온다. 원인은 cause에 매단다
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new NoResponseError(`응답 없음 (${timeoutMs}ms 초과) ${path}`, {
        cause: error,
      })
    }
    throw new NoResponseError(`서버에 닿지 못했습니다 ${path}`, { cause: error })
  }

  // 상태 코드가 무엇이든 응답이 왔다는 건 서버가 살아 있다는 뜻이다
  resetBreaker()

  if (response.status === 401 && options?.ignoreUnauthorized !== true) {
    redirectToLogin()
  }
  if (!response.ok) {
    throw new ApiError(
      // 개발자용 문구다. 화면은 utils/error.ts의 toUserMessage를 거쳐 그린다
      `요청 실패 (${response.status}) ${path}`,
      response.status,
      await readErrorCode(response),
    )
  }
  return (await response.json()) as T
}

/**
 * { isSuccess, result } 래퍼를 벗긴다. 실패면 서버가 준 message로 던진다.
 * 그 문구는 서버가 사람에게 보여주라고 쓴 한국어라 UserFacingError로 갈라 둔다.
 */
function unwrap<T>(body: ApiResponse<T>): T {
  if (!body.isSuccess) {
    throw new UserFacingError(body.message)
  }
  return body.result
}

/** MarketController 계열: 공통 래퍼 없이 데이터가 그대로 내려온다 */
export function getRaw<T>(path: string, options?: RequestOptions): Promise<T> {
  return requestJson<T>(path, undefined, options)
}

/** 그 외: { isSuccess, result } 래퍼를 벗겨 result만 반환한다 */
export async function get<T>(
  path: string,
  options?: RequestOptions,
): Promise<T> {
  return unwrap(await requestJson<ApiResponse<T>>(path, undefined, options))
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

/** 이미 있는 자원의 일부만 고친다. 서버가 PUT이 아니라 PATCH를 쓴다 */
export async function patch<T>(
  path: string,
  body: unknown,
  options?: RequestOptions,
): Promise<T> {
  return unwrap(
    await requestJson<ApiResponse<T>>(
      path,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      options,
    ),
  )
}

/** 서버에 값을 보낸다. 본문을 JSON 문자열로 바꾸고 Content-Type으로 알려준다 */
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
