import { get, patch, remove } from './client'
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
 * 값이 비는 모양을 넓게 받아준다. 성향을 검사하지 않은 회원(member.personality가 null)에게
 * 서버가 무엇을 돌려주는지 확인되지 않아서다 — 본문이 null일 수도, 필드만 빈 채 올 수도 있다.
 *
 * 다만 **통신·서버 오류는 삼키지 않고 던진다.** 부르는 쪽이
 * "아직 검사 안 함"과 "못 불러옴"을 다른 화면으로 보여줘야 하기 때문이다.
 * 서버가 미검사 회원에게 예외를 던지는 쪽이라면 그건 오류로 잡히는데,
 * 어느 쪽인지는 백엔드 확인이 필요하다(전달 사항 3번).
 */
export async function getMyPersonality(): Promise<PersonalityInfo | null> {
  const result = await get<PersonalityInfo | null>(
    '/api/members/me/personality',
  )
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
 * ⚠️ **번호를 알아야 부를 수 있다.** 이름('위험중립형')이 아니라 personalityId를 받는데,
 * 그 번호를 알려주는 창구가 **성향테스트 결과 하나뿐이다**(`submitTest`의 응답).
 * 즉 지금은 "방금 검사해서 받은 번호"만 알 수 있고, 다섯 성향의 번호 전체는 모른다.
 * 그래서 화면에 '직접 고르기'를 아직 붙이지 못했다 — 목록을 지어내면 사용자의 성향이
 * 엉뚱한 값으로 바뀌는데, 틀려도 화면에는 성공으로 보인다.
 *
 * 성향 목록을 번호와 함께 주는 API가 생기거나 번호 표를 받으면 그때 화면을 붙인다.
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
