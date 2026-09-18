import { get, patch, post, remove } from './client'
import type {
  LikeStockList,
  MemberInfo,
  MemberUpdate,
  PersonalityInfo,
} from '../types/member'

/**
 * 회원 창구. 전부 로그인이 필요하다(토큰이 없거나 만료면 서버가 401을 주고
 * client.ts가 로그인 화면으로 보낸다).
 */

export function getMemberInfo(): Promise<MemberInfo> {
  return get<MemberInfo>('/api/members/me')
}

/**
 * 이름·생일 수정. 서버가 이름 2~4자, 생일은 오늘 이전인지 검사하고
 * 어긋나면 400에 이유를 담아 준다(ApiError.message로 화면에 그대로 보여주면 된다).
 */
export async function updateMemberInfo(update: MemberUpdate): Promise<void> {
  await patch<{ modifiedDate: string }>('/api/members/me', update)
}

/**
 * 저장된 내 투자성향. 아직 검사하지 않았으면 null.
 *
 * 값이 비는 모양을 넓게 받아준다. 성향을 검사하지 않은 회원에게 서버가 본문을
 * null로 줄 수도, 필드만 빈 채 줄 수도 있어서다.
 *
 * 다만 **통신·서버 오류는 삼키지 않고 던진다.** 부르는 쪽이
 * "아직 검사 안 함"과 "못 불러옴"을 다른 화면으로 보여줘야 하기 때문이다.
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

/* ── 관심종목 ─────────────────────────────────────────────────────────── */

/**
 * 관심종목 등록. 이미 등록된 종목을 또 보내면 서버가 409를 준다.
 * 홈의 하트가 낙관적으로 먼저 켜지고 이 요청이 실패하면 되돌린다.
 */
export async function likeStock(stockCode: string): Promise<void> {
  await post<unknown>('/api/members/me/like-stocks', { stockCode })
}

export async function unlikeStock(stockCode: string): Promise<void> {
  await remove<unknown>(
    `/api/members/me/like-stocks/${encodeURIComponent(stockCode)}`,
  )
}

/** 내 관심종목 목록. 시세는 baseDate 종가 기준이다 */
export function getLikeStocks(): Promise<LikeStockList> {
  return get<LikeStockList>('/api/members/me/like-stocks')
}
