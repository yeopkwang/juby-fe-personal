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
 * ✅ 나갈 수 있는 경로 목록. **여기 없으면 못 나간다.**
 *
 * 막는 목록이 아니라 **허용 목록**인 것이 핵심이다. 둘은 실수했을 때가 다르다.
 * 막는 목록은 빠뜨리면 그 경로가 조용히 뚫리고, 허용 목록은 빠뜨려도 안 나갈 뿐이다.
 * 새 API를 붙이는 사람이 여기 적는 걸 잊으면 화면이 바로 실패하니 눈에 띈다.
 * 잘못될 방향이 안전한 쪽인 구조를 고른다.
 *
 * ## 기준: 팀 노션의 '완료' 표. 스웨거가 아니다.
 *
 * 스웨거에는 아직 개발 중인 것까지 다 올라와 있어서, 그걸 보고 붙이면 백엔드가
 * 만들지도 않은 API를 부르게 된다. 실제로 그렇게 붙였다가 되돌린 것들이 있다.
 * **명세의 근거는 노션 한 곳뿐이고, 노션에 '완료'로 찍힌 것만 여기 적는다.**
 *
 * ## 지금 목록에 없는 것들 (부르면 안 된다)
 *
 * | 경로 | 왜 빠졌나 |
 * | --- | --- |
 * | `/api/market/**` | 증권사(KIS) 중계. 계정 정지 경고를 받아 막아 둔 그 경로다 |
 * | `/api/token`, `/api/initiate` | 마찬가지로 KIS를 부른다. 프론트는 원래 안 쓴다 |
 * | `/api/news` | 네이버 검색 중계. 관련도 정렬이 없었다. 종목 뉴스는 `/api/stocks/{code}/news`로 옮겼다 |
 * | `/api/open-ai/ask`, `/v1/ai/sessions` | AI 표에 행이 하나도 없다 |
 * | `/api/guides` | 노션에서 확인하지 못했다 |
 * | `/v1/auth/logout` | 인증 API. 프론트가 건드리지 않기로 했다 |
 *
 * 막힌 요청은 '실패'로 떨어진다. 화면들은 이미 실패를 다루게 되어 있어서
 * 홈은 저장해 둔 지난 시세로, 나머지는 각자의 에러 안내로 넘어간다.
 *
 * KIS 경로는 노션에 완료로 있더라도 여기 적으면 안 된다. 증권사 계정 문제는
 * 명세와 별개의 사정이라, 백엔드가 다 만들었어도 부르지 않는 것이 맞다.
 *
 * ## "KIS를 거치면 무조건 금지"는 아니다 — 문제는 **몰아치기**였다
 *
 * `/api/stocks/{stockCode}`는 백엔드에서 KIS 현재가를 **1건** 부른다(나머지 OHLCV는 DB).
 * 그런데도 허용한 이유는, 계정 경고를 부른 것이 KIS를 거친다는 사실 자체가 아니라
 * **홈이 102종목을 한 번에 몰아쳐 108건을 만든 것**이었기 때문이다. 상세 화면은
 * 사용자가 종목 하나를 열 때 1건이고, 심지어 이 창구로 옮기면서 상세의 KIS 호출이
 * 2건(현재가+일봉)에서 1건으로 **줄었다.** 판단 기준은 경로 이름이 아니라 호출량이다.
 */
const ALLOWED_PREFIXES = [
  /* 백테스트 — 실행·프리셋·기간 옵션. 백엔드 자기 DB만 읽는다 */
  '/api/backtest',
  /* 성향테스트 문항 조회·결과 제출 */
  '/api/personality-tests',
  /* 내 정보 조회·수정·탈퇴, 내 투자성향 조회·변경 */
  '/api/members/me',
  /*
   * 종목 상세 — OHLCV 조회, 종목별 뉴스 조회.
   *
   * OHLCV는 백엔드 daily_price 테이블, 뉴스는 Pinecone이라 둘 다 자기 데이터다.
   * 상세 조회가 현재가·전일대비 두 값만 KIS에서 가져오는데, **종목 하나당 1건**이라
   * 홈(102종목 108건)에서 문제가 됐던 몰아치기와는 성격이 다르다. 오히려 이 창구로
   * 옮기면서 상세 화면의 KIS 호출이 2건에서 1건으로 줄었다.
   */
  '/api/stocks',
]

function isAllowed(path: string): boolean {
  return ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))
}

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

/**
 * 2xx가 아닌 응답. `status`와 서버가 붙인 `code`를 들고 다닌다.
 *
 * 부르는 쪽이 **"실패했다"와 "그런 건 없다"를 갈라야 할 때가 있어서** 만들었다.
 * 예를 들어 성향 조회는 아직 검사하지 않은 회원에게 404 `MEMBER404_2`를 주는데,
 * 그건 오류 화면이 아니라 '검사하러 가기' 화면으로 보내야 할 신호다.
 * 상태 코드만으로는 부족하다 — 같은 404라도 `MEMBER404_1`은 진짜 오류다.
 *
 * `message`는 예전과 **한 글자도 다르지 않다.** 이 문구를 그대로 제목으로 그리는
 * 화면이 있어서(StockChartPage), 여기서 바꾸면 그쪽까지 함께 바뀐다.
 * 서버 문구를 사람 말로 보여주는 일은 따로 다룬다.
 */
export class ApiError extends Error {
  status: number
  /** 서버가 붙인 코드("MEMBER404_2"). 본문이 그 모양이 아니면 null */
  code: string | null

  /* 생성자 파라미터 프로퍼티는 쓸 수 없다 — tsconfig의 erasableSyntaxOnly */
  constructor(message: string, status: number, code: string | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/**
 * 실패 응답의 본문에서 코드만 꺼낸다.
 *
 * 본문이 없거나 JSON이 아닐 수 있고(게이트웨이가 대신 답하는 경우), 그건 오류가 아니다.
 * 코드를 못 읽으면 없는 셈 치고 status만으로 판단하게 둔다.
 */
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
  /*
   * 무엇보다 먼저 확인한다. 아래 어떤 경로로도 fetch에 닿지 못하게 여기서 끊는다.
   * 증권사 계정 보호를 위한 조치라 실수로 새어 나가면 안 된다.
   */
  if (!isAllowed(path)) {
    throw new Error(
      `허용 목록에 없는 경로입니다 (src/api/client.ts의 ALLOWED_PREFIXES) ${path}`,
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
    throw new ApiError(
      // 문구는 그대로 둔다. 화면들이 이 message를 그리고 있어 바꾸면 같이 바뀐다
      `요청 실패 (${response.status}) ${path}`,
      response.status,
      await readErrorCode(response),
    )
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
 * 이미 있는 자원의 일부만 고친다. 보내는 방식은 post와 같고 메서드만 다르다.
 * 서버가 PUT이 아니라 PATCH를 쓰므로(보낸 항목만 바꾼다) 이름을 맞춘다.
 */
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
