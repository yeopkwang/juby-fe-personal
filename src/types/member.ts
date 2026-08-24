import type { PersonalityType } from './personality'

/**
 * `GET /api/members/me`의 응답. 명세에 적힌 세 가지가 전부다.
 *
 * 백엔드 `MemberResDto.MemberInfo`는 `socialType`도 함께 주지만 화면이 안 써서 뺐다.
 */
export interface MemberInfo {
  name: string
  email: string
  /**
   * "2002-05-07". null일 수 있다.
   * 백엔드 parseBirth()가 소셜에서 생년월일을 못 받으면 null을 저장하는데,
   * 구글은 기본 스코프에 생일이 없어 실제로 자주 그렇게 된다.
   */
  birth: string | null
}

/**
 * `GET /api/members/me/personality`의 응답.
 * 노션 명세는 둘뿐인데 백엔드는 description(정상 철자)에 personalityImg까지 준다.
 * 코드를 따른다.
 */
export interface PersonalityInfo {
  investPersonality: PersonalityType
  description: string
  /** 서버가 가진 이미지 주소. 비어 있으면 화면이 로컬 SVG로 대신한다 */
  personalityImg: string | null
}
