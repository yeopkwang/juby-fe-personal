import { get } from './client'
import { delay } from '../utils/async'
import type { AskResult, ChatMessage, ChatSession, ChatSessionDetail } from '../types/ai'

/**
 * AI 주가분석 창구. 질문 보내기는 실제로 `/api/open-ai/ask`를 부르고
 * 대화 목록·상세는 아직 mock이다(`/v1/ai/sessions` 4종이 백엔드에 없다).
 *
 * ⚠️ 답변은 돌아오지 않는다. 백엔드 `OpenAiService.askQuestion()`이 void라 생성한
 * 답변을 로그에 찍고 버린다. 그래도 연결해 두는 편이 낫다 — 질문이 서버까지 닿는지가
 * 로그로 확인되고, String을 반환하도록 바뀌면 여기 한 줄만 고치면 된다.
 */

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
 * 질문을 서버로 보낸다.
 * 세션 번호와 제목은 아직 프론트가 만든다. 서버에 대화를 저장하는 곳이 없어
 * 새로고침하면 방금 나눈 대화가 사라진다.
 */
export async function ask(
  question: string,
  stockName: string,
  sessionId?: number,
): Promise<AskResult> {
  await get<null>(
    `/api/open-ai/ask?question=${encodeURIComponent(question)}` +
      `&stock_name=${encodeURIComponent(stockName)}`,
  )

  return {
    sessionId: sessionId ?? nextSessionId++,
    /* 서버는 첫 질문을 요약해 제목을 만든다. 여기서는 앞부분을 잘라 흉내만 낸다 */
    title: toTitle(question),
    // 빈 말풍선은 '실패'로 읽히고 지어낸 답은 더 나쁘다. 무슨 일인지 그대로 적는다
    answer:
      '질문은 서버까지 전달됐어요. 다만 서버가 만든 답변을 아직 돌려주지 않아서 ' +
      '여기에 옮길 내용이 없습니다.\n\n' +
      '백엔드가 답변을 반환하도록 바뀌면 이 자리에 그대로 나옵니다.',
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
