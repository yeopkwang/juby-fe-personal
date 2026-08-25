import { FAST_TIMEOUT, get, post } from './client'
import { isLoggedIn } from '../utils/auth'
import { PERSONALITY_INFO, scoreToPersonality } from '../utils/personality'
import type {
  PersonalityResult,
  PersonalityType,
  Question,
} from '../types/personality'

/**
 * 투자성향테스트 창구. 문항 조회와 결과 제출 둘뿐이다.
 * 백엔드 준비 전에 쓰던 토글과 MOCK_QUESTIONS는 문항 10개가 DB에 들어오면서 걷어냈다.
 */

interface QuestionListResponse {
  questions: Question[]
}

/** POST 응답. 백엔드 `TestResponseDto.TestResultRes`와 같은 모양이다 */
interface TestResultResponse {
  memberId: number
  memberName: string
  personalityId: number
  personalityName: PersonalityType
  /** 노션 명세는 `discription`이지만 백엔드 코드가 `description`이다. 코드를 따른다 */
  description: string
  /** 성향 그림 주소. personality 테이블이 비어 있으면 빈 문자열로 온다 */
  url: string
}

/**
 * 문항을 questionId 오름차순으로 맞춘다.
 * 서버가 findAll()을 정렬 없이 부르므로 순서가 보장되지 않는다.
 * 보기도 같은 이유로 choiceId 순으로 세운다.
 */
function sortByIds(questions: Question[]): Question[] {
  return [...questions]
    .sort((a, b) => a.questionId - b.questionId)
    .map((question) => ({
      ...question,
      choices: [...question.choices].sort((a, b) => a.choiceId - b.choiceId),
    }))
}

/** 문항 조회. 로그인 없이도 된다(SecurityConfig가 /api/**를 permitAll로 연다) */
export async function getQuestions(): Promise<Question[]> {
  const { questions } = await get<QuestionListResponse>(
    '/api/personality-tests',
    { timeoutMs: FAST_TIMEOUT },
  )

  /*
   * 빈 목록은 성공이 아니라 실패로 친다.
   *
   * 문항은 누가 DB에 직접 넣어야 생기는데(백엔드에 넣는 코드가 없다) 비어 있으면
   * 서버가 200에 빈 배열을 준다. 그대로 넘기면 화면이 questions[0]에서 터진다.
   * 터진 뒤에 수습하는 것보다 여기서 실패로 다루는 쪽이 문구가 정확하다.
   */
  if (questions === undefined || questions.length === 0) {
    throw new Error('성향 테스트 문항이 비어 있습니다')
  }

  return sortByIds(questions)
}

/**
 * 고른 보기의 점수를 낱개 그대로 보낸다. 서버가 합산해 성향을 정하고 저장한다.
 * (문항 10개 × 배점 1/3/5/7/9라 합계가 서버 유효 구간 10~90에 정확히 들어온다.)
 *
 * 비로그인은 서버에 보내지 않는다. 이 API는 @AuthenticationPrincipal을 쓰므로 토큰
 * 없이 부르면 401이 아니라 NPE로 500이 나서, 문항을 다 푼 사람이 마지막에 원인 모를
 * 오류를 만난다. 대신 화면에서 채점한다 — 구간이 서버와 같아 성향도 같고 저장만
 * 안 된다. 그 사실은 saved로 결과 화면이 말해 준다.
 */
export async function submitTest(scores: number[]): Promise<PersonalityResult> {
  if (!isLoggedIn()) {
    const total = scores.reduce((sum, score) => sum + score, 0)
    const type = scoreToPersonality(total)

    return {
      type,
      ...PERSONALITY_INFO[type],
      // 서버를 안 거쳤으니 번호를 알 길이 없다
      personalityId: null,
      saved: false,
    }
  }

  const result = await post<TestResultResponse>('/api/personality-tests', {
    scores,
  })

  /* personality 테이블이 비어 있으면 설명과 그림이 빈 문자열로 온다. 그때는 로컬 문구를 쓴다 */
  const fallback = PERSONALITY_INFO[result.personalityName]

  return {
    type: result.personalityName,
    description: result.description || fallback.description,
    imageUrl: result.url || fallback.imageUrl,
    personalityId: result.personalityId,
    saved: true,
  }
}
