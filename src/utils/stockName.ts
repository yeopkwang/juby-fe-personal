import { STOCK_LIST } from '../api/stockList'

/**
 * 질문 문장에서 종목명을 찾아낸다.
 *
 * 백엔드가 `stock_name`을 별도 파라미터로 요구한다. Pinecone 검색을 종목명으로 필터링하는데
 * 질문에서 종목을 뽑는 로직이 서버에 없어서 프론트가 대신 한다.
 * **서버가 이 추출을 맡게 되면 이 파일은 통째로 지운다.**
 *
 * 목록에 있는 이름만 찾는다. 목록 밖 종목은 어차피 백엔드 벡터DB에도 없다.
 */

/*
 * 긴 이름부터 본다. "삼성전자우"를 "삼성전자"로, "한화에어로스페이스"를 "한화"로
 * 잘못 집는 것을 막는다. 목록이 고정이라 모듈을 읽을 때 한 번만 정렬한다.
 */
const NAMES_BY_LENGTH = STOCK_LIST.map((stock) => stock.stockName).sort(
  (a, b) => b.length - a.length,
)

/** 못 찾으면 빈 문자열. 그때는 화면이 종목명을 같이 적어달라고 안내한다 */
export function findStockName(question: string): string {
  return NAMES_BY_LENGTH.find((name) => question.includes(name)) ?? ''
}
