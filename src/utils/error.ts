/**
 * 실패를 사람 말로 옮기는 곳.
 *
 * 예전에는 통신 창구가 실패를 전부 `new Error('요청 실패 (500) /api/stocks/005930')`
 * 한 가지로 만들었다. 개발자가 콘솔에서 보라고 쓴 문구인데, 화면이 그걸 그대로
 * `error.message`로 꺼내 **제목(h1)에 박아 놨다.** 사용자는 자기가 뭘 잘못했는지,
 * 다시 눌러 보면 되는지 알 수 없었다.
 *
 * 그래서 **실패의 종류를 타입으로** 나눈다. 문구를 뜯어보는 방식(`message.includes(...)`)은
 * 문구를 고치는 순간 조용히 어긋나기 때문에 쓰지 않는다.
 *
 * | 종류 | 언제 | 다시 눌러 볼 만한가 |
 * | --- | --- | --- |
 * | `ApiError` | 서버가 2xx가 아닌 답을 줬다 | 500이면 그렇다, 404면 아니다 |
 * | `NoResponseError` | 서버가 아예 답하지 않았다 | 그렇다 |
 * | `BlockedPathError` | 허용 목록에 없는 경로다 | **아니다.** 백 번 불러도 같다 |
 * | `UserFacingError` | 문구가 이미 사람 말이다 | 경우에 따라 |
 *
 * 이 네 가지에 안 걸리는 것(예: 코드 버그로 인한 `TypeError`)은 사용자에게 보여 줄
 * 말이 없다. 그때는 뭉뚱그린 문구로 덮고 원본은 콘솔로 보낸다 — 지어낸 설명보다 낫다.
 */

/**
 * 2xx가 아닌 응답. `status`와 서버가 붙인 `code`를 들고 다닌다.
 *
 * 부르는 쪽이 **"실패했다"와 "그런 건 없다"를 갈라야 할 때가 있어서** 만들었다.
 * 예를 들어 성향 조회는 아직 검사하지 않은 회원에게 404 `MEMBER404_2`를 주는데,
 * 그건 오류 화면이 아니라 '검사하러 가기' 화면으로 보내야 할 신호다.
 * 상태 코드만으로는 부족하다 — 같은 404라도 `MEMBER404_1`은 진짜 오류다.
 *
 * `message`는 개발자용이다. **화면에 그대로 그리지 않는다.** 아래 `toUserMessage`를 거친다.
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
 *
 * `ApiError`와 갈라 두는 이유는 **사용자에게 할 말이 다르기** 때문이다.
 * 500은 "서버가 뭔가 잘못했다"이고 이쪽은 "서버가 지금 자리에 없다"라서,
 * 후자는 잠시 뒤 다시 눌러 보라고 권할 만하다.
 */
export class NoResponseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'NoResponseError'
  }
}

/**
 * 허용 목록(`client.ts`의 `ALLOWED_PREFIXES`)에 없는 경로를 불렀다.
 *
 * **다시 시도해서 달라질 여지가 0인 유일한 실패다.** 서버 사정이 아니라 이 앱이
 * 스스로 막아 둔 것이라, 화면은 '다시 시도' 버튼을 내밀면 안 된다.
 */
export class BlockedPathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BlockedPathError'
  }
}

/**
 * 문구가 **이미 사람에게 보여도 되는** 실패.
 *
 * 두 곳에서 난다. ① 서버가 `{ isSuccess: false, message }`로 준 문구,
 * ② 화면 코드가 직접 상황을 설명하며 던진 문구("종목의 성향을 비교할 자료를 받지
 * 못했습니다."). 둘 다 이미 한국어 완성문이라 뭉뚱그린 문구로 덮으면 오히려 나빠진다.
 *
 * 이 타입이 있어야 "덮어야 할 개발자 문구"와 "그대로 보여줄 문구"가 갈린다.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserFacingError'
  }
}

/**
 * 실패 하나를 화면에 적을 한 문장으로 바꾼다.
 *
 * `notFound`를 따로 받는 이유는 **404가 화면마다 다른 뜻**이기 때문이다.
 * 종목 상세에서는 "없는 종목"이고, 성향 조회에서는 "아직 검사 안 함"이다.
 * 나머지는 어느 화면에서나 뜻이 같아 여기서 한 번에 정한다.
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
    /*
     * 이 백엔드는 토큰 없이 부른 요청에 401이 아니라 500(NPE)을 준다(CLAUDE.md 참고).
     * 그래도 401을 지우지는 않는다 — 나중에 고쳐질 자리이고, 그때 여기는 이미 맞다.
     */
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
 *
 * 막힌 경로는 앱이 스스로 막은 것이라 백 번 불러도 결과가 같다. 그런 자리에
 * '다시 시도' 버튼을 두면 눌러도 아무 일이 안 생기는 버튼이 된다.
 * 404도 마찬가지다 — 없는 것은 다시 물어도 없다.
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof BlockedPathError) return false
  if (error instanceof ApiError && error.status === 404) return false
  return true
}
