import type { PersonalityType, Question } from '../types/personality'

/**
 * 서버가 성향을 가르는 점수 구간. 총점이 이 안에 들어와야 결과가 나온다.
 * 벗어나면 서버가 예외를 던진다(PersonalityTestService).
 */
const SERVER_MIN = 10
const SERVER_MAX = 90

/**
 * 문항 배점으로 나올 수 있는 총점의 최소·최대.
 *
 * 숫자를 상수로 박지 않고 받은 문항에서 계산하는 이유가 실제로 증명됐다.
 * 임시 7문항은 보기 수가 5/3/2로 제각각이라 합계가 9~63이었고, 백엔드가 채운
 * 10문항은 10~90이다. 계산해서 쓴 덕에 문항이 바뀔 때 고칠 곳이 없었다.
 */
export function getScoreRange(questions: Question[]): { min: number; max: number } {
  let min = 0
  let max = 0

  for (const question of questions) {
    const scores = question.choices.map((choice) => choice.score)
    min += Math.min(...scores)
    max += Math.max(...scores)
  }

  return { min, max }
}

/**
 * 원점수를 서버 구간(10~90)으로 늘려 옮긴다.
 *
 *   환산점수 = 10 + (원점수 - 최소점) / (최대점 - 최소점) × 80
 *
 * 이렇게 해야 모든 보기를 최저로 고르면 안정형, 최고로 고르면 공격투자형이 나온다.
 * 서버가 정수 배열을 받으므로 반올림한다.
 *
 * 백엔드 문항(10~90)에서는 원점수가 이미 서버 구간과 같아 들어온 값이 그대로 나온다.
 * 즉 지금은 아무 일도 하지 않는다. 그래도 남겨 두는 건 mock으로 되돌렸을 때
 * 다시 필요해지기 때문이다.
 */
export function normalizeScore(raw: number, questions: Question[]): number {
  const { min, max } = getScoreRange(questions)
  // 문항이 없거나 배점이 전부 같으면 나눌 수 없다. 하한을 돌려주고 끝낸다
  if (max === min) return SERVER_MIN

  const ratio = (raw - min) / (max - min)
  return Math.round(SERVER_MIN + ratio * (SERVER_MAX - SERVER_MIN))
}

/** 서버 PersonalityTestService의 구간과 동일하게 맞춘다 */
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
