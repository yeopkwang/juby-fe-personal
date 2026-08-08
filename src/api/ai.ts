import { delay } from '../utils/async'
import type { AskResult, ChatMessage, ChatSession, ChatSessionDetail } from '../types/ai'

/**
 * AI 주가분석 창구.
 *
 * **지금은 전부 mock이다.** 백엔드에 `/v1/ai/sessions` 4종이 아직 없고,
 * 있는 `/api/open-ai/ask`는 생성한 답변을 `log.info()`로 흘려버려 프론트로 오지 않는다
 * (`OpenAiService.askQuestion()`이 void). 그쪽이 String을 반환하도록 바뀌면
 * 이 파일의 **함수 안쪽만** 실제 호출로 갈아끼우면 된다. 화면 코드는 손대지 않는다.
 *
 * 응답 형태는 요구사항서에 적어둔 가정을 따른다. 명세가 확정되면 문서와 이 파일을 함께 고친다.
 */

/** 서버 왕복이 있는 척한다. 로딩 상태가 실제로 보이는지 확인하려면 지연이 필요하다 */
const MOCK_LATENCY = 1500

const MOCK_SESSIONS: ChatSession[] = [
  { sessionId: 1, title: '한화디펜스 전쟁 영향' },
  { sessionId: 2, title: 'HYBE 콘서트 성공 여부' },
  { sessionId: 3, title: 'LG에너지솔루션 분석' },
  { sessionId: 4, title: '에스오일 석유화학 관련' },
  { sessionId: 5, title: 'SK하이닉스 사업분석' },
  { sessionId: 6, title: 'GS건설 수주사업' },
]

/** 새 세션에 붙일 번호. 서버가 발급하기 시작하면 필요 없어진다 */
let nextSessionId = MOCK_SESSIONS.length + 1

/** GET /v1/ai/sessions 로 교체 */
export async function getSessions(): Promise<ChatSession[]> {
  await delay(300)
  return MOCK_SESSIONS
}

/** GET /v1/ai/sessions/{sessionId} 로 교체 */
export async function getSessionDetail(
  sessionId: number,
): Promise<ChatSessionDetail> {
  await delay(500)

  const session =
    MOCK_SESSIONS.find((item) => item.sessionId === sessionId) ??
    { sessionId, title: '대화' }

  return { ...session, messages: mockMessages(session.title) }
}

/**
 * POST /v1/ai/sessions (새 대화) 또는 POST /v1/ai/sessions/{sessionId} (이어하기) 로 교체.
 * 그때 stockName은 요청 본문에 함께 실어 보낸다.
 */
export async function ask(
  question: string,
  stockName: string,
  sessionId?: number,
): Promise<AskResult> {
  await delay(MOCK_LATENCY)

  return {
    sessionId: sessionId ?? nextSessionId++,
    /* 서버는 첫 질문을 요약해 제목을 만든다. 여기서는 앞부분을 잘라 흉내만 낸다 */
    title: toTitle(question),
    answer:
      `(준비 중) 백엔드 AI 응답 연동 전입니다.\n\n` +
      `질문: ${question}\n` +
      `종목: ${stockName === '' ? '(못 찾음)' : stockName}`,
  }
}

function toTitle(question: string): string {
  const trimmed = question.trim()
  return trimmed.length <= 20 ? trimmed : `${trimmed.slice(0, 20)}…`
}

/**
 * 사용자와 AI가 번갈아 나오는 예시 대화.
 * 말풍선 폭·줄바꿈·스크롤이 실제 길이에서 어떻게 보이는지 확인하려고 길이를 섞어 뒀다.
 */
function mockMessages(title: string): ChatMessage[] {
  const contents: string[] = [
    `${title}에 대해 알려줘.`,
    `(예시 응답) ${title} 관련해서 확인된 내용을 정리해 드릴게요.\n\n` +
      `아직 백엔드 연동 전이라 실제 분석 결과가 아닙니다. ` +
      `연동이 끝나면 이 자리에 뉴스 검색(RAG)을 거친 답변이 표시됩니다.`,
    '그럼 지금 사는 건 어때?',
    `(예시 응답) 투자 판단은 직접 하셔야 해요.\n` +
      `다만 확인해두면 좋은 지표는 알려드릴 수 있습니다.`,
  ]

  return contents.map((content, index) => ({
    messageId: index + 1,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content,
    /* 예시 데이터라 시각은 의미가 없다. 화면에도 아직 안 쓴다 */
    createdAt: new Date().toISOString(),
  }))
}
