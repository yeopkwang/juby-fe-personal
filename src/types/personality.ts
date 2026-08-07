export interface Choice {
  choiceId: number
  content: string
  score: number
}

export interface Question {
  questionId: number
  content: string
  choices: Choice[]
}

/**
 * 백엔드 InvestPersonality enum과 글자까지 똑같아야 한다.
 * 서버가 이 문자열을 그대로 내려주므로 하나라도 다르면 결과 화면이 빈다.
 */
export type PersonalityType =
  | '안정형'
  | '안정추구형'
  | '위험중립형'
  | '적극투자형'
  | '공격투자형'

export interface PersonalityResult {
  type: PersonalityType
  description: string
  imageUrl: string
}
