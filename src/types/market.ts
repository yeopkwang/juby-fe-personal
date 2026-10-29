/** 국내 지수 한 줄(코스피·코스닥). 화면 아래 지수 띠(MarketIndexBar)가 그린다 */
export interface MarketIndex {
  /** 증권사 업종 코드. 코스피 0001, 코스닥 1001. 서버가 비워 보내면 이름으로 대신한다 */
  code: string
  name: string
  /** 지수(포인트) */
  value: number
  /** 전일 대비(포인트). 내리면 음수 */
  change: number | null
  /** 전일 대비율(%). 0.47이면 +0.47% */
  changeRate: number | null
}

export interface MarketIndices {
  indices: MarketIndex[]
  /** 받은 때(ms). 띠는 "10월 29일 15:30 기준"으로 적는다 */
  receivedAt: number
  /** 백엔드 지수 API가 나오기 전의 예시 값이면 true. 띠가 "예시 값"이라고 밝힌다(api/market.ts USE_SAMPLE) */
  isSample: boolean
}
