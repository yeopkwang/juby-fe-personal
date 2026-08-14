import { get, post } from './client'
import { isLoggedIn } from '../utils/auth'
import { PERSONALITY_INFO, scoreToPersonality } from '../utils/personality'
import type {
  PersonalityResult,
  PersonalityType,
  Question,
} from '../types/personality'

/**
 * 투자성향테스트 창구. 문항 조회와 결과 제출 둘뿐이다.
 *
 * 예전에는 `USE_BACKEND_QUESTIONS` / `USE_BACKEND_SUBMIT` 토글과 7문항짜리
 * `MOCK_QUESTIONS`가 있었다. 백엔드가 준비되기 전에 화면을 만들려고 둔 것인데,
 * 지금은 문항 10개가 DB에 들어와 있고 채점도 서버가 하므로 전부 걷어냈다.
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
  /**
   * 노션 명세에는 `discription`으로 적혀 있지만 **백엔드 코드가 `description`이다.**
   * 오타는 문서 쪽이므로 코드를 따른다.
   */
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
  const { questions } = await get<QuestionListResponse>('/api/personality-tests')

  /*
   * 빈 목록은 성공이 아니라 실패로 친다.
   *
   * 문항은 누가 DB에 직접 넣어야 생긴다(백엔드에 넣는 코드가 없다). 비어 있으면
   * 서버는 200에 빈 배열을 준다. 그대로 넘기면 화면이 `questions[0]`에서 undefined를
   * 집어 터지는데, **이 앱에는 ErrorBoundary가 없어서 흰 화면이 된다.**
   * 여기서 던져야 화면의 catch가 받아 '문항을 불러오지 못했습니다'로 넘어간다.
   */
  if (questions === undefined || questions.length === 0) {
    throw new Error('성향 테스트 문항이 비어 있습니다')
  }

  return sortByIds(questions)
}

/**
 * 고른 보기의 점수를 **낱개 그대로** 보낸다. 서버가 합산해 성향을 정하고 저장한다.
 *
 * 한때는 점수를 하나로 환산해 보냈다. 임시 문항이 7개뿐이라 낱개를 그대로 보내면
 * 합계가 서버 유효 구간(10~90) 아래로 떨어져 500이 났기 때문이다.
 * 지금은 문항이 10개이고 배점이 1/3/5/7/9라 합계가 정확히 10~90이 되므로
 * 환산이 필요 없어졌다(`normalizeScore`를 지운 이유다).
 *
 * ## 로그인하지 않았으면 서버에 보내지 않는다
 *
 * 이 API는 `@AuthenticationPrincipal`로 사용자를 꺼내므로 토큰 없이 부르면
 * **401이 아니라 NPE로 500**이 난다. 그대로 두면 문항 10개를 다 푼 사람이
 * 마지막에 원인 모를 오류를 만난다.
 *
 * 그래서 비로그인은 화면에서 채점한다. 구간이 서버(`PersonalityTestService`)와
 * 같은 값이라 나오는 성향도 같다 — 다른 점은 **저장되지 않는다**는 것뿐이고,
 * 그 사실은 `saved`로 알려 결과 화면이 말해 준다.
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
