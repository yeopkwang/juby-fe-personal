import { delay } from '../utils/async'
import type { GuideSection } from '../types/guide'

/*
 * 사용설명서 창구.
 *
 *   USE_BACKEND_GUIDE  false → 아래 MOCK_SECTIONS / true → GET /api/guides
 *
 * 지금은 false다. 백엔드에 설명서 API도 테이블도 없다(Swagger에 /api/guides가 없음).
 * 글이 DB로 들어오면 이 플래그만 true로 바꾼다. 응답을 MOCK_SECTIONS와 같은 모양으로
 * 맞춰 두면 화면 코드는 손대지 않아도 된다.
 */
const USE_BACKEND_GUIDE = false

/** 서버에서 오는 척한다. 로딩 자리가 실제로 보이는지 확인하려면 지연이 필요하다 */
const MOCK_LATENCY = 300

/* 글이 아직 하나도 없다. 꼭지를 여럿 늘어놓아 봐야 전부 같은 안내라 한 칸만 둔다 */
const MOCK_SECTIONS: GuideSection[] = [
  {
    guideId: 'intro',
    title: 'JUBY 사용법',
    body: ['준비중입니다.'],
  },
]

/** 설명서 전체. 꼭지 순서가 곧 목차 순서다 */
export async function getGuideSections(): Promise<GuideSection[]> {
  if (!USE_BACKEND_GUIDE) {
    await delay(MOCK_LATENCY)
    return MOCK_SECTIONS
  }

  // 켤 때 이 줄을 살린다: return get<GuideSection[]>('/api/guides')
  throw new Error('설명서 API가 아직 없습니다')
}
