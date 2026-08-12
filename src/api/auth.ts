import { post } from './client'
import { clearTokens, getRefreshToken } from '../utils/auth'

/**
 * 로그아웃. 서버에 refresh token을 넘겨 무효화하고 브라우저에 남은 토큰을 지운다.
 *
 * 서버 요청이 실패해도 토큰은 지운다(finally). 사용자는 이미 나가겠다고 눌렀는데
 * 서버가 응답을 못 한다고 로그인 상태로 남겨두는 편이 더 위험하다.
 * refresh token이 없어 요청이 거절되는 경우도 결과는 같다.
 *
 * 화면 이동은 여기서 하지 않는다. 부르는 쪽에서 navigate로 옮기면 된다 —
 * 헤더는 clearTokens()가 내는 알림을 듣고 알아서 '로그인'으로 돌아간다.
 *
 * ⛔ `/v1/auth/logout`은 지금 허용 목록에 없다(client.ts). 노션 완료 목록에 없고
 * 인증 API라 프론트에서 건드리지 않기로 한 쪽이다. 그래서 요청은 던져지자마자 실패하는데,
 * **동작에는 문제가 없다.** 아래 구조가 원래 서버 실패를 삼키고 finally에서 토큰을 지운다.
 * 결과적으로 지금은 '브라우저에서만 로그아웃'이 된다.
 */
export async function logout(): Promise<void> {
  try {
    // body 키가 refreshToken이 아니라 refresh_token(스네이크 케이스)이다. 백엔드 명세 기준
    await post(
      '/v1/auth/logout',
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
