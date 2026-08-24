import type { PersonalityType } from '../types/personality'

/**
 * 총점을 성향으로 옮긴다. 서버 PersonalityTestService의 구간을 옮겨 적은 것이다.
 *
 * 비로그인은 제출 API를 부를 수 없어(토큰 없이 부르면 500) 화면에서 대신 매긴다.
 * 문항 10개 × 배점 1·3·5·7·9라 총점은 반드시 10~90 안에 들어온다.
 * ⚠️ 백엔드가 구간을 바꾸면 여기도 바꾼다. 안 그러면 로그인 여부에 따라 결과가 갈린다.
 */
export function scoreToPersonality(score: number): PersonalityType {
  if (score < 15) return '안정형'
  if (score < 35) return '안정추구형'
  if (score < 55) return '위험중립형'
  if (score < 75) return '적극투자형'
  return '공격투자형'
}

/**
 * 성향별 설명과 이미지. 서버 값이 비어 있을 때 쓰는 대비책이다.
 * 설명의 줄바꿈은 화면에서 white-space: pre-line으로 살린다.
 */
export const PERSONALITY_INFO: Record<
  PersonalityType,
  { description: string; imageUrl: string }
> = {
  안정형: {
    description:
      '원금 손실을 무엇보다 먼저 피하며\n예금·적금 수준의 안정적인 수익을 기대하는 스타일',
    imageUrl: '/personality/stable.svg',
  },
  안정추구형: {
    description:
      '원금을 지키는 것을 우선하되\n낮은 위험을 감수해 예금보다 나은 수익을 노리는 스타일',
    imageUrl: '/personality/conservative.svg',
  },
  위험중립형: {
    description:
      '안정성과 수익성 사이에서 균형을 추구하며\n시장 평균 수준의 위험을 감수하는 스타일',
    imageUrl: '/personality/neutral.svg',
  },
  적극투자형: {
    description:
      '원금 손실 위험을 감수하더라도\n시장 평균보다 높은 수익을 적극적으로 추구하는 스타일',
    imageUrl: '/personality/active.svg',
  },
  공격투자형: {
    description:
      '높은 기대수익을 좇아\n큰 폭의 손실까지 감수할 수 있는 스타일',
    imageUrl: '/personality/aggressive.svg',
  },
}

/**
 * 화면에 늘어놓는 순서. 안정 → 공격으로 위험이 커지는 차례이고,
 * 백엔드 `InvestPersonality` enum의 선언 순서와도 같다.
 */
export const PERSONALITY_ORDER: PersonalityType[] = [
  '안정형',
  '안정추구형',
  '위험중립형',
  '적극투자형',
  '공격투자형',
]

/**
 * 성향 이름 → PATCH /api/members/me/personality가 받는 personalityId.
 *
 * ⚠️ 확인된 표가 아니라 추정이다. 번호는 personality 테이블의 자동 증가 id라 누가
 * 어떤 순서로 행을 넣었느냐로 정해지는데, 시드 SQL도 번호를 알려주는 API도 없다.
 * 확실한 건 범위뿐이다 — PersonalityErrorCode가 "1 ~ 5 사이"라고 말한다.
 * 그래서 PERSONALITY_ORDER(= enum 선언 순서)를 그대로 1~5로 놓았다.
 *
 * 틀려도 조용히 넘어가지 않게 MypagePersonalityPage가 변경 뒤 다시 조회해
 * 서버가 실제로 저장한 이름을 보여준다. 그 받침을 빼면 안 된다.
 * `SELECT id, invest_personality FROM personality;` 결과를 받으면 이 표만 고치면 된다.
 */
export const PERSONALITY_IDS: Record<PersonalityType, number> = {
  안정형: 1,
  안정추구형: 2,
  위험중립형: 3,
  적극투자형: 4,
  공격투자형: 5,
}
