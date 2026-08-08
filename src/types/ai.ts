/** 말한 쪽. 백엔드 ChatContent에는 아직 이 구분 필드가 없다(스키마 수정 요청함) */
export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  messageId: number
  role: ChatRole
  content: string
  /** ISO 8601. 백엔드 ChatContent에 생성 시각 필드가 생기면 그 값이 온다 */
  createdAt: string
}

/** 사이드바 한 줄. title은 첫 질문을 서버가 요약한 문자열이다 */
export interface ChatSession {
  sessionId: number
  title: string
}

export interface ChatSessionDetail extends ChatSession {
  messages: ChatMessage[]
}

/** 질문 전송 결과. 새 세션이면 sessionId가 새로 발급된다 */
export interface AskResult extends ChatSession {
  answer: string
}
