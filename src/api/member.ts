import { get, remove } from './client'
import type { MemberInfo, PersonalityInfo } from '../types/member'

/**
 * 회원 정보 창구. 여기 셋은 백엔드에 이미 구현되어 있어 실제 API를 부른다.
 *
 * 정보 수정(PATCH /api/members/me)도 서버에는 있지만 이번 범위에서 뺐다.
 * 수정 폼 UI가 Figma에 없어 화면 설계가 먼저 정해져야 한다.
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

/** 탈퇴. 성공하면 계정과 성향 정보가 서버에서 모두 지워진다 */
export function deleteMember(): Promise<null> {
  return remove<null>('/api/members/me')
}
