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
  /**
   * 서버가 매긴 성향 번호. 로그인하고 검사했을 때만 있다.
   * 번호를 알려주는 창구가 검사 결과 하나뿐이라 여기까지 들고 온다.
   */
  personalityId: number | null
  /**
   * 이 결과가 서버에 저장됐는지. 비로그인 검사는 화면에서만 계산해 새로고침하면
   * 사라진다. 그 차이를 말해 줘야 "검사했는데 마이페이지에 없다"고 헤매지 않는다.
   */
  saved: boolean
}
