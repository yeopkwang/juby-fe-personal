import type { PersonalityType } from './personality'

/**
 * `GET /api/members/me`의 응답. 명세에 적힌 세 가지가 전부다.
 *
 * 백엔드 `MemberResDto.MemberInfo`는 `socialType`(NAVER/KAKAO/GOOGLE)도 함께 주지만
 * 화면 어디에서도 쓰지 않아 받지 않는다. 가입 경로를 보여줄 일이 생기면 그때 넣는다.
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
 *
 * 노션 명세에는 `investPersonality`와 `discription` 둘뿐인데, **백엔드 코드는
 * `description`(정상 철자)에 `personalityImg`까지 준다.** 철자는 코드를 따랐고
 * 그림도 받아 쓴다 — 문서 쪽이 줄여 적힌 것으로 본다.
 */
export interface PersonalityInfo {
  investPersonality: PersonalityType
  description: string
  /** 서버가 가진 이미지 주소. 비어 있으면 화면이 로컬 SVG로 대신한다 */
  personalityImg: string | null
}
