/** 사용설명서 한 꼭지. 나중에 DB에서 이 모양 그대로 내려주면 된다 */
export interface GuideSection {
  /** 목차 앵커로도 쓴다. DB로 옮기면 PK 대신 slug 칼럼이 된다 */
  guideId: string
  title: string
  /** 문단 목록. 지금은 준비중 안내 한 줄뿐이다 */
  body: string[]
}
