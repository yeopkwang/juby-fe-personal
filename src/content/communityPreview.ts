/*
 * 홈 오른쪽 아래 "커뮤니티" 칸의 예시 글. 커뮤니티 백엔드가 아직 없어 지어낸 글이다(2026-10-30 사용자 결정 — 목업 글로 먼저 보인다).
 * 화면은 칸 제목 옆과 맨 아래에 "예시"라고 밝힌다. 글은 투자를 권하거나 수익을 말하지 않는 질문·감상으로만 짓는다.
 * 백엔드가 생기면 src/api로 옮기고 이 파일을 지운다.
 */

interface PreviewPost {
  id: number
  /** 종목 이름이나 말머리(자유·질문) */
  tag: string
  title: string
  author: string
  /** 몇 분 전 글인지. "최신" 정렬과 "12분 전" 표시에 쓴다 */
  minutesAgo: number
  comments: number
  likes: number
}

export const COMMUNITY_PREVIEW_POSTS: PreviewPost[] = [
  { id: 1, tag: '삼성전자', title: '백테스트 처음 돌려 봤는데 점수 보는 법 알려 주실 분', author: '주린이공부중', minutesAgo: 12, comments: 8, likes: 14 },
  { id: 2, tag: 'SK하이닉스', title: '1년 그래프로 보니 생각보다 많이 내렸네요', author: '반도체관심', minutesAgo: 35, comments: 5, likes: 9 },
  { id: 3, tag: '자유', title: '투자성향 테스트 위험중립형 나왔어요. 다들 뭐 나오셨어요?', author: '월급쟁이투자', minutesAgo: 64, comments: 21, likes: 30 },
  { id: 4, tag: '질문', title: '백테스트 결과에 나오는 MDD가 뭔가요?', author: '처음이에요', minutesAgo: 128, comments: 6, likes: 4 },
  { id: 5, tag: '한화에어로스페이스', title: '차트 아래 거래량 막대는 어떻게 읽나요?', author: '차트독학', minutesAgo: 190, comments: 3, likes: 7 },
]
