import { post } from './client'
import { clearTokens, getRefreshToken } from '../utils/auth'

/**
 * 로그아웃. 서버에 refresh token을 넘겨 무효화하고 브라우저에 남은 토큰을 지운다.
 *
 * 서버 요청이 실패해도 토큰은 지운다(finally). 나가겠다고 누른 사람을 로그인 상태로
 * 남겨두는 편이 더 위험하다. 화면 이동은 부르는 쪽이 한다.
 *
 * ⛔ `/v1/auth/logout`은 허용 목록에 없어 요청이 던져지자마자 실패한다. 아래 구조가
 * 그걸 삼키고 finally에서 토큰을 지우므로 지금은 '브라우저에서만 로그아웃'이 된다.
 */
export async function logout(): Promise<void> {
  try {
    // body 키가 refreshToken이 아니라 refresh_token이다. 백엔드 명세 기준
    await post(
      '/v1/auth/logout',
      { refresh_token: getRefreshToken() },
      // 토큰이 만료된 채 눌러도 부르는 쪽이 정한 곳으로 가야 한다
      { ignoreUnauthorized: true },
    )
  } catch {
    // 서버 쪽 실패는 삼킨다. 아래에서 어차피 로컬 토큰을 지운다
  } finally {
    clearTokens()
  }
}
