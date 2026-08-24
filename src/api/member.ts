import { get, patch, remove } from './client'
import { ApiError } from '../utils/error'
import type { MemberInfo, PersonalityInfo } from '../types/member'

/**
 * 회원 정보 창구 — 조회 / 수정 / 탈퇴 / 성향 조회 / 성향 변경.
 *
 * 전부 로그인이 필요한데 토큰 없이 부르면 401이 아니라 500이 온다.
 * 서버가 @AuthenticationPrincipal에서 곧바로 id를 꺼내다 NPE를 내기 때문이다.
 * 부르는 쪽이 미리 막고 들어와야 한다(MypageLayout이 그 역할).
 */

export function getMemberInfo(): Promise<MemberInfo> {
  return get<MemberInfo>('/api/members/me')
}

/**
 * 저장된 내 투자성향. 아직 검사하지 않았으면 null.
 *
 * 미검사 회원에게 서버는 404 MEMBER404_2를 던진다. 오류가 아니라 '아직 안 함'이라
 * 여기서 null로 옮긴다 — 안 그러면 검사 안 한 사람이 마이페이지에서
 * "불러오지 못했습니다"를 본다. 코드까지 보는 건 같은 404라도 MEMBER404_1(회원 없음)은
 * 진짜 오류라서다. 나머지 오류도 삼키지 않고 던진다.
 */
export async function getMyPersonality(): Promise<PersonalityInfo | null> {
  let result: PersonalityInfo | null
  try {
    result = await get<PersonalityInfo | null>('/api/members/me/personality')
  } catch (error: unknown) {
    if (
      error instanceof ApiError &&
      error.status === 404 &&
      error.code === 'MEMBER404_2'
    ) {
      return null
    }
    throw error
  }
  // 성향 이름이 없으면 결과 화면을 그릴 수 없다. 없는 것으로 본다
  return result === null || !result.investPersonality ? null : result
}

/**
 * 이름과 생년월일을 고친다. 서버가 받는 항목은 이 둘뿐이다
 * (이메일과 소셜 종류는 소셜 계정에서 온 값이라 바꿀 수 없다).
 *
 * 서버 제약을 그대로 옮겨 적는다. 어기면 400이 온다.
 *   name  — 2~4자
 *   birth — YYYY-MM-DD, 오늘 이전
 *
 * birth가 빈 값이면 항목을 아예 빼고 보낸다. 서버가 null인 항목은 건드리지 않아
 * 저장된 값이 그대로 남는다. 빈 문자열을 보내면 400이다.
 */
export function updateMemberInfo(
  name: string,
  birth: string,
): Promise<{ modifiedDate: string }> {
  const body = birth ? { name, birth } : { name }
  return patch<{ modifiedDate: string }>('/api/members/me', body)
}

/**
 * 저장된 투자성향을 다른 것으로 바꾼다. 검사를 다시 풀지 않고 직접 고르는 길이다.
 *
 * ⚠️ 이름이 아니라 번호(personalityId)를 받는데 그 번호표를 주는 API가 없어
 * utils/personality.ts의 PERSONALITY_IDS가 추정으로 메운다. 틀렸을 때 조용히
 * 넘어가지 않게 하는 책임은 부르는 쪽에 있다 — MypagePersonalityPage가 변경 뒤
 * getMyPersonality()를 다시 불러 서버가 실제로 저장한 이름을 보여준다.
 */
export function changeMyPersonality(
  personalityId: number,
): Promise<{ modifiedAt: string }> {
  return patch<{ modifiedAt: string }>('/api/members/me/personality', {
    personalityId,
  })
}

/** 탈퇴. 성공하면 계정과 성향 정보가 서버에서 모두 지워진다 */
export function deleteMember(): Promise<null> {
  return remove<null>('/api/members/me')
}
