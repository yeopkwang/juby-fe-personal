import { post } from './client'
import { clearTokens, getRefreshToken } from '../utils/auth'

/**
 * 로그아웃. 서버에 refresh token을 넘겨 무효화하고 브라우저에 남은 토큰을 지운다.
 *
 * 서버 요청이 실패해도 토큰은 지운다(finally). 사용자는 이미 나가겠다고 눌렀는데
 * 서버가 응답을 못 한다고 로그인 상태로 남겨두는 편이 더 위험하다.
 * refresh token이 없어 요청이 거절되는 경우도 결과는 같다.
 *
 * 화면 이동은 여기서 하지 않는다. 헤더는 그려질 때 isLoggedIn()을 한 번 읽을 뿐이라
 * 부르는 쪽에서 window.location.href = '/'로 통째로 새로 고쳐야 우측이 '로그인'으로 돌아온다.
 */
export async function logout(): Promise<void> {
  try {
    /*
     * ⚠️ 이 API는 백엔드에 아직 없다(2026-09-18 확인: /api/auth 를 다루는 컨트롤러가 없음).
     * 작업 보드에는 POST /api/auth/logout 으로 "진행 중"이라 그 경로를 적어 둔다.
     * 예전 /v1/auth/logout 은 존재한 적이 없는 주소였다.
     * 본문 키(refresh_token)도 아직 명세가 없어 추정값이다. 생기면 여기만 맞춘다.
     */
    await post(
      '/api/auth/logout',
      { refresh_token: getRefreshToken() },
      // 토큰이 만료된 채 눌러도 로그인 화면이 아니라 부르는 쪽이 정한 곳으로 가야 한다
      { ignoreUnauthorized: true },
    )
  } catch {
    // 서버 쪽 실패는 삼킨다. 아래에서 어차피 로컬 토큰을 지운다
  } finally {
    clearTokens()
  }
}
