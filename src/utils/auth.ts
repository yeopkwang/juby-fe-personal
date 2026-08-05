/**
 * 로그인 여부.
 * client.ts가 요청 헤더에 쓰는 것과 같은 키를 본다.
 * 백엔드 소셜 로그인이 완성되면 콜백에서 이 키에 토큰을 저장하는 것만 추가하면 된다.
 */
export function isLoggedIn(): boolean {
  return localStorage.getItem('accessToken') !== null
}
