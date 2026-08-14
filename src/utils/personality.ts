import type { PersonalityType } from '../types/personality'

/**
 * 총점을 성향으로 옮긴다. **서버 `PersonalityTestService`의 구간을 그대로 옮겨 적은 것이다.**
 *
 * 원래는 서버만 채점하면 되지만, 로그인하지 않은 사람은 제출 API를 부를 수 없어
 * (토큰 없이 부르면 500) 화면에서 대신 매긴다. 그래서 두 곳이 같아야 한다.
 *
 * 서버 구간: 10~14 안정형 / 15~34 안정추구형 / 35~54 위험중립형 /
 *            55~74 적극투자형 / 75~90 공격투자형
 * 문항 10개 × 배점 1·3·5·7·9라 총점은 반드시 10~90 안에 들어온다.
 *
 * **백엔드가 구간을 바꾸면 여기도 바꿔야 한다.** 안 그러면 로그인 여부에 따라
 * 같은 답에서 다른 성향이 나온다.
 */
export function scoreToPersonality(score: number): PersonalityType {
  if (score < 15) return '안정형'
  if (score < 35) return '안정추구형'
  if (score < 55) return '위험중립형'
  if (score < 75) return '적극투자형'
  return '공격투자형'
}

/**
 * 성향별 설명과 이미지.
 *
 * 서버 채점으로 넘어가면 description과 url을 서버가 준다. 그때는 이 표가
 * 서버 값이 비어 있을 때 쓰는 대비책이 된다(personality 테이블도 아직 비어 있다).
 *
 * 설명의 줄바꿈은 화면에서 white-space: pre-line으로 살린다.
 * 서버 문구에 줄바꿈이 없어도 그냥 이어져 나올 뿐 깨지지 않는다.
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
