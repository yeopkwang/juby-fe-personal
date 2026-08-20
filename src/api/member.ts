import { ApiError, get, patch, remove } from './client'
import type { MemberInfo, PersonalityInfo } from '../types/member'

/**
 * 회원 정보 창구. 다섯 가지 전부 백엔드에 구현되어 있다.
 *   조회 / 수정 / 탈퇴 / 성향 조회 / 성향 변경
 *
 * 전부 로그인이 필요하다. 그런데 **토큰 없이 부르면 401이 아니라 500**이 온다 —
 * 서버가 `@AuthenticationPrincipal`에서 곧바로 id를 꺼내다 NPE를 내기 때문이다.
 * 부르는 쪽은 미리 로그인 여부를 보고 들어와야 한다(MypageLayout이 막고 있다).
 */

export function getMemberInfo(): Promise<MemberInfo> {
  return get<MemberInfo>('/api/members/me')
}

/**
 * 저장된 내 투자성향. 아직 검사하지 않았으면 null.
 *
 * **미검사 회원에게 서버는 404를 던진다.** (2026-08-20 백엔드 소스에서 확인 —
 * `MemberService.getPersonalityInfo`가 `member.getPersonality()`가 null이면
 * `MemberErrorCode.PERSONALITY_NOT_FOUND`, 즉 404 `MEMBER404_2`를 낸다.)
 * 그건 오류가 아니라 '아직 안 함'이라는 뜻이므로 여기서 null로 옮긴다.
 * 그러지 않으면 검사 한 번 안 한 사람이 마이페이지에서
 * "불러오지 못했습니다 / 로그인이 풀렸을 수 있어요"를 보게 된다.
 *
 * 코드까지 보고 가르는 이유는 **같은 404라도 `MEMBER404_1`(회원을 찾을 수 없음)은
 * 진짜 오류**이기 때문이다. 그건 그대로 던져야 한다.
 *
 * 그 밖의 통신·서버 오류도 삼키지 않고 던진다. 부르는 쪽이
 * "아직 검사 안 함"과 "못 불러옴"을 다른 화면으로 보여줘야 하기 때문이다.
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
 * birth가 빈 값이면 **항목을 아예 빼고 보낸다.** 서버가 null인 항목은 건드리지 않아
 * (Member.updateInfo) 저장된 생년월일이 그대로 남는다. 빈 문자열을 보내면 400이다.
 *
 * 응답은 수정 시각 하나뿐이라 화면이 쓸 값이 없다. 고친 내용은 다시 조회해서 받는다.
 */
export function updateMemberInfo(
  name: string,
  birth: string,
): Promise<{ modifiedDate: string }> {
  const body = birth === '' ? { name } : { name, birth }
  return patch<{ modifiedDate: string }>('/api/members/me', body)
}

/**
 * 저장된 투자성향을 다른 것으로 바꾼다. 검사를 다시 풀지 않고 직접 고르는 길이다.
 *
 * ⚠️ **이름이 아니라 번호(`personalityId`)를 받는다.** 어느 번호가 어느 성향인지
 * 알려주는 창구가 없어서 `utils/personality.ts`의 `PERSONALITY_IDS`가 추정으로 메운다.
 * 그 표의 주석을 반드시 읽고 쓴다 — **틀렸을 때 조용히 넘어가지 않게 하는 책임이
 * 부르는 쪽에 있다.** MypagePersonalityPage는 변경 뒤 `getMyPersonality()`를 다시 불러
 * 서버가 실제로 저장한 이름을 보여주는 것으로 그 책임을 진다.
 *
 * 응답은 수정 시각 하나뿐이라 화면이 쓸 값이 없다. 바뀐 성향은 다시 조회해서 받는다.
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
