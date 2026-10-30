/**
 * 가입 경로(소셜 로그인)의 이름과 아이콘. 아이콘은 로그인 단추와 같은 파일이다(public/social).
 * 서버가 모르는 값을 주면 null — 화면이 그 줄을 빼고 그린다.
 */
const SOCIAL: Record<string, { name: string; icon: string }> = {
  KAKAO: { name: '카카오', icon: '/social/kakao.svg' },
  NAVER: { name: '네이버', icon: '/social/naver.svg' },
  GOOGLE: { name: '구글', icon: '/social/google.svg' },
}

export function socialLabel(socialType: unknown): { name: string; icon: string } | null {
  return typeof socialType === 'string' && Object.hasOwn(SOCIAL, socialType) ? SOCIAL[socialType] : null
}
