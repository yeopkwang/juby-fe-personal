import type { PersonalityType } from './personality'

/** 가입 경로. 백엔드 Member.socialType과 같은 값이다 */
export type SocialType = 'NAVER' | 'KAKAO' | 'GOOGLE'

export interface MemberInfo {
  name: string
  email: string
  /**
   * "2002-05-07". null일 수 있다.
   * 백엔드 parseBirth()가 소셜에서 생년월일을 못 받으면 null을 저장하는데,
   * 구글은 기본 스코프에 생일이 없어 실제로 자주 그렇게 된다.
   */
  birth: string | null
  socialType: SocialType
}

export interface PersonalityInfo {
  investPersonality: PersonalityType
  description: string
  /** 서버가 가진 이미지 주소. 비어 있으면 화면이 로컬 PNG로 대신한다 */
  personalityImg: string | null
}

/**
 * 프로필 사진 주소. 지금은 언제나 null이다.
 *
 * 백엔드 Member 엔티티에 이미지 필드 자체가 없다. 네이버·구글 응답 DTO에는
 * 꺼내는 코드가 있는데(NaverResponse.getProfileImage, GoogleResponse의 picture)
 * CustomOAuth2MemberService가 저장하지 않고 버린다.
 * 카카오는 profile_image_needs_agreement=true라 동의 항목 설정 없이는 받아올 수도 없다.
 *
 * 필드가 생기면 이 타입을 MemberInfo에 넣고 값만 채우면 화면은 그대로 붙는다.
 */
export type ProfileImageUrl = string | null
