/**
 * 실패를 사람 말로 옮기는 곳.
 *
 * 예전에는 창구가 실패를 전부 `new Error('요청 실패 (500) /api/stocks/005930')` 하나로
 * 만들었고, 화면이 그 개발자용 문구를 그대로 h1에 박았다.
 *
 * 그래서 실패의 종류를 타입으로 나눈다. 문구를 뜯어보는 방식(message.includes)은
 * 문구를 고치는 순간 조용히 어긋나서 쓰지 않는다.
 *
 * | 종류 | 언제 | 다시 눌러 볼 만한가 |
 * | --- | --- | --- |
 * | ApiError | 서버가 2xx가 아닌 답을 줬다 | 500이면 그렇다, 404면 아니다 |
 * | NoResponseError | 서버가 아예 답하지 않았다 | 그렇다 |
 * | BlockedPathError | 허용 목록에 없는 경로다 | 아니다. 백 번 불러도 같다 |
 * | UserFacingError | 문구가 이미 사람 말이다 | 경우에 따라 |
 *
 * 넷에 안 걸리는 것(코드 버그의 TypeError 등)은 보여 줄 말이 없다. 뭉뚱그린 문구로
 * 덮고 원본은 콘솔로 보낸다 — 지어낸 설명보다 낫다.
 */

/**
 * 2xx가 아닌 응답. status와 서버가 붙인 code를 들고 다닌다.
 *
 * code까지 드는 이유는 상태 코드만으로 부족해서다. 성향 조회는 아직 검사하지 않은
 * 회원에게 404 MEMBER404_2를 주는데 그건 '검사하러 가기'로 보낼 신호이고,
 * 같은 404라도 MEMBER404_1은 진짜 오류다. message는 개발자용이다.
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
 * 서버에 닿지 못했다. 제한 시간 초과·연결 실패·차단기가 여기 들어온다.
 * ApiError와 가르는 건 할 말이 달라서다 — 500은 "서버가 잘못했다",
 * 이쪽은 "서버가 지금 자리에 없다"라서 잠시 뒤 다시 눌러 보라고 권할 만하다.
 */
export class NoResponseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'NoResponseError'
  }
}

/**
 * 허용 목록(client.ts의 ALLOWED_PREFIXES)에 없는 경로를 불렀다.
 * 서버 사정이 아니라 이 앱이 스스로 막은 것이라 다시 눌러도 결과가 같다.
 */
export class BlockedPathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BlockedPathError'
  }
}

/**
 * 문구가 이미 사람에게 보여도 되는 실패.
 *
 * 서버가 `{ isSuccess: false, message }`로 준 것과 화면 코드가 상황을 설명하며 던진
 * 것 둘이다. 이미 한국어 완성문이라 뭉뚱그린 문구로 덮으면 오히려 나빠진다.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserFacingError'
  }
}

/**
 * 실패 하나를 화면에 적을 한 문장으로 바꾼다.
 * notFound만 따로 받는 건 404가 화면마다 뜻이 달라서다 — 상세는 "없는 종목",
 * 성향 조회는 "아직 검사 안 함". 나머지는 어디서나 같아 여기서 정한다.
 */
export function toUserMessage(
  error: unknown,
  notFound = '요청하신 정보를 찾을 수 없습니다.',
): string {
  if (error instanceof UserFacingError) return error.message

  if (error instanceof BlockedPathError) {
    return '아직 준비되지 않은 기능입니다.'
  }

  if (error instanceof NoResponseError) {
    return '서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.'
  }

  if (error instanceof ApiError) {
    if (error.status === 404) return notFound
    // 이 백엔드는 토큰 없이 부르면 401이 아니라 500(NPE)을 준다. 그래도 지우진 않는다
    if (error.status === 401 || error.status === 403) {
      return '로그인이 필요한 기능입니다.'
    }
    if (error.status >= 500) {
      return '서버에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.'
    }
    return '요청을 처리하지 못했습니다.'
  }

  return '불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

/**
 * 다시 눌러 볼 만한 실패인가.
 * 막힌 경로는 백 번 불러도 같고 404도 다시 물어도 없다. 그런 자리에 버튼을 두면
 * 눌러도 아무 일이 안 생겨서 사용자는 자기 인터넷을 의심하며 계속 누른다.
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof BlockedPathError) return false
  if (error instanceof ApiError && error.status === 404) return false
  return true
}
