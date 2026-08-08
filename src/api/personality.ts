import { get, post } from './client'
import {
  PERSONALITY_INFO,
  normalizeScore,
  scoreToPersonality,
} from '../utils/personality'
import { isLoggedIn } from '../utils/auth'
import type {
  PersonalityResult,
  PersonalityType,
  Question,
} from '../types/personality'

/*
 * 문항 출처와 채점 위치를 여기서 정한다. 화면 코드는 어느 쪽이든 똑같이 동작한다.
 *
 *   USE_BACKEND_QUESTIONS  false → 아래 MOCK_QUESTIONS / true → GET /api/personality-tests
 *   USE_BACKEND_SUBMIT     false → 프론트에서 채점    / true → POST /api/personality-tests
 *
 * 지금은 둘 다 false다. 백엔드 personality_test·choices 테이블이 비어 있어
 * 조회 API가 200에 빈 배열을 돌려주기 때문이다.
 *
 * 문항 데이터가 들어오면 USE_BACKEND_QUESTIONS만 true로,
 * personality 테이블까지 채워지면 USE_BACKEND_SUBMIT도 true로 바꾼다.
 * 제출은 로그인이 있어야 하므로 조회보다 늦게 켜야 한다.
 */
const USE_BACKEND_QUESTIONS = false
const USE_BACKEND_SUBMIT = false

interface QuestionListResponse {
  questions: Question[]
}

interface TestResultResponse {
  memberId: number
  memberName: string
  personalityId: number
  personalityName: PersonalityType
  description: string
  url: string
}

/**
 * 문항을 questionId 오름차순으로 맞춘다.
 * 서버가 findAll()을 정렬 없이 부르므로 순서가 보장되지 않는다.
 * 보기도 같은 이유로 choiceId 순으로 세운다(mock은 화면에 놓을 순서대로 번호를 매겨 뒀다).
 */
function sortByIds(questions: Question[]): Question[] {
  return [...questions]
    .sort((a, b) => a.questionId - b.questionId)
    .map((question) => ({
      ...question,
      choices: [...question.choices].sort((a, b) => a.choiceId - b.choiceId),
    }))
}

export async function getQuestions(): Promise<Question[]> {
  if (!USE_BACKEND_QUESTIONS) return sortByIds(MOCK_QUESTIONS)

  const { questions } = await get<QuestionListResponse>('/api/personality-tests')
  return sortByIds(questions)
}

/**
 * 고른 보기의 점수들을 받아 성향을 낸다.
 *
 * questions를 같이 받는 이유는 환산에 배점 범위가 필요해서다.
 * 문항이 바뀌면 범위도 바뀌므로 그때그때 받은 목록에서 계산한다.
 */
export async function submitTest(
  questions: Question[],
  scores: number[],
): Promise<PersonalityResult> {
  const raw = scores.reduce((sum, score) => sum + score, 0)
  const normalized = normalizeScore(raw, questions)

  if (!USE_BACKEND_SUBMIT) {
    const type = scoreToPersonality(normalized)
    return { type, ...PERSONALITY_INFO[type] }
  }

  /*
   * 서버는 받은 배열을 전부 더해 구간에 넣는다. 이미 환산한 총점을 넘겨야 하므로
   * 낱개 점수 대신 환산값 하나만 담아 보낸다.
   * 백엔드가 7문항 기준으로 구간을 다시 잡으면 scores를 그대로 보내도록 되돌린다.
   */
  const result = await post<TestResultResponse>('/api/personality-tests', {
    scores: [normalized],
  })

  // personality 테이블이 비어 있으면 설명과 이미지가 빈 문자열로 온다. 그때는 로컬 문구를 쓴다
  const fallback = PERSONALITY_INFO[result.personalityName]
  return {
    type: result.personalityName,
    description: result.description || fallback.description,
    imageUrl: result.url || fallback.imageUrl,
  }
}

interface MyPersonalityResponse {
  personalityName: PersonalityType
}

/**
 * 저장된 내 투자성향. AI 주가분석 빈 화면이 쓴다.
 *
 * 성향을 모르는 경우가 정상 흐름에 여럿 있다(비로그인, 아직 검사 전, 이 API 미구현).
 * 어느 쪽이든 화면이 할 일은 같아서 — 그 영역을 통째로 숨긴다 — 전부 null로 뭉뚱그린다.
 * 지어낸 기본값을 돌려주면 검사도 안 한 사람에게 성향을 알려주는 꼴이 된다.
 */
export async function getMyPersonality(): Promise<PersonalityType | null> {
  // 토큰이 없으면 부를 이유가 없다. 401을 만들지 않는 편이 client.ts의 이동 규칙과도 안 엉킨다
  if (!isLoggedIn()) return null

  try {
    const result = await get<MyPersonalityResponse>('/api/members/me/personality')
    return result.personalityName ?? null
  } catch (error: unknown) {
    console.warn('투자성향 조회 실패', error)
    return null
  }
}

/**
 * 확정된 7문항. 배점은 아직 백엔드와 공유되지 않은 임시값이다.
 *
 * 실제 조회 응답과 같은 모양으로 둔다. 그래야 USE_BACKEND_QUESTIONS를 켜는 것만으로
 * 화면 코드를 한 줄도 안 고치고 넘어갈 수 있다.
 * choiceId는 실제 DB의 PK처럼 전 문항 통틀어 1부터 이어 붙인다.
 */
const MOCK_QUESTIONS: Question[] = [
  {
    questionId: 1,
    content:
      '나에게 1천만 원의 여유 자금이 생겼다.\n1천만 원을 예금과 주식투자로 배분한다면?',
    choices: [
      { choiceId: 1, content: '예금 1,000만 원', score: 1 },
      { choiceId: 2, content: '예금 700만원, 주식 300만원', score: 3 },
      { choiceId: 3, content: '예금 500만원, 주식 500만원', score: 5 },
      { choiceId: 4, content: '예금 300만원, 주식 700만원', score: 7 },
      { choiceId: 5, content: '주식 1,000만 원', score: 9 },
    ],
  },
  {
    questionId: 2,
    content: '이 자금으로 투자를 한다면 어느 정도 기간 동안 투자할 것인가?',
    choices: [
      { choiceId: 6, content: '1개월 미만', score: 1 },
      { choiceId: 7, content: '1개월 이상 ~ 6개월 미만', score: 3 },
      { choiceId: 8, content: '6개월 이상 ~ 1년 미만', score: 5 },
      { choiceId: 9, content: '1년 이상 ~ 3년 미만', score: 7 },
      { choiceId: 10, content: '3년 이상', score: 9 },
    ],
  },
  {
    questionId: 3,
    content:
      '내 월급에서 여유자금이 매달 100만원씩 생긴다면,\n매달 이 돈을 적금과 주식에 어느정도로 배분할 것인가?',
    choices: [
      { choiceId: 11, content: '적금 100만원', score: 1 },
      { choiceId: 12, content: '적금 70만원, 주식 30만원', score: 3 },
      { choiceId: 13, content: '적금 50만원, 주식 50만원', score: 5 },
      { choiceId: 14, content: '적금 30만원, 주식 70만원', score: 7 },
      { choiceId: 15, content: '주식 100만원', score: 9 },
    ],
  },
  {
    questionId: 4,
    content: '자산관리 원칙 중 내가 우선시하는 특성 순서는?',
    choices: [
      { choiceId: 16, content: '안정성 > 유동성 > 수익성', score: 1 },
      { choiceId: 17, content: '안정성 > 수익성 > 유동성', score: 3 },
      { choiceId: 18, content: '유동성 > 안정성 > 수익성', score: 5 },
      { choiceId: 19, content: '유동성 > 수익성 > 안정성', score: 7 },
      { choiceId: 20, content: '수익성 > 안정성 > 유동성', score: 9 },
    ],
  },
  {
    questionId: 5,
    content: '내가 가장 선호하는 금융 상품은?',
    choices: [
      { choiceId: 21, content: '예금', score: 1 },
      { choiceId: 22, content: '채권', score: 5 },
      { choiceId: 23, content: '주식', score: 9 },
    ],
  },
  {
    /*
     * 이 문항만 위험 선호 항목이 먼저 나온다. 화면 순서는 그대로 두고 점수만 각 보기에 붙인다.
     * 위에서 아래로 점수가 커지지 않는 유일한 문항이다.
     */
    questionId: 6,
    content: '내가 더 선호하는 투자 전략은?',
    choices: [
      {
        choiceId: 24,
        content:
          '원금 손실 위험이 있더라도 시장 평균보다 높은 수익률을 기대',
        score: 9,
      },
      {
        choiceId: 25,
        content:
          '원금 손실 위험이 잘 분산된 포트폴리오를 구성해 시장 평균 정도의 투자 성과를 기대',
        score: 3,
      },
    ],
  },
  {
    questionId: 7,
    content: '투자를 통해 만약 손실이 난다면 어느 정도까지 수용할 수 있는가?',
    choices: [
      {
        choiceId: 26,
        content: '무슨 일이 있어도 투자원금은 보전되어야 한다.',
        score: 1,
      },
      {
        choiceId: 27,
        content: '10% 미만까지는 손실을 감수할 수 있을 것 같다.',
        score: 3,
      },
      {
        choiceId: 28,
        content: '20% 미만까지는 손실을 감수할 수 있을 것 같다.',
        score: 5,
      },
      {
        choiceId: 29,
        content: '40% 미만까지는 손실을 감수할 수 있을 것 같다.',
        score: 7,
      },
      {
        choiceId: 30,
        content: '기대수익이 높다면 위험이 높아도 상관하지 않겠다.',
        score: 9,
      },
    ],
  },
]
