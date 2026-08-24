import { getRecentCandles } from './market'
import { toYmd } from '../utils/date'
import { withRetry } from '../utils/async'
import type { Candle } from '../types/market'

/**
 * 홈 카드 스파크라인용 일봉 창구.
 *
 * 예전에는 상세 화면 차트도 여기서 받았다. 그 요청만 KIS 모의투자 서버로 중계돼
 * 건당 1.5~2.4초가 걸려서 12시간 캐시와 hover 미리받기로 버티는 구조였다.
 * 2026-08-19에 상세가 `GET /api/stocks/{stockCode}`(백엔드 DB)로 옮겨가면서
 * 그 캐시와 미리받기를 걷어냈다. 여기 남은 건 홈 카드 몫뿐이다.
 */

/**
 * 아직 안 끝난 오늘 봉을 잘라낸다.
 *
 * 증권사가 주는 가장 최근 봉은 장이 닫히기 전까지 확정 종가가 아니라 그 순간의 현재가라,
 * 그대로 쓰면 새로고침할 때마다 차트 끝과 등락률이 움직인다.
 * 날짜가 YYYYMMDD 문자열이라 사전순 비교가 곧 날짜순 비교다.
 */
function dropUnsettled(candles: Candle[]): Candle[] {
  const today = toYmd(new Date())
  const settled = candles.filter((candle) => candle.date < today)
  // 오늘 것밖에 없는 종목이면 빈 차트를 보여주느니 그거라도 그린다
  return settled.length > 0 ? settled : candles
}

/**
 * 최근 30거래일(약 6주)만 받는 빠른 길. 홈 카드는 최근 흐름만 그리면 된다(60ms).
 * 초당 호출 제한(EGW00201)에 걸려 500이 오는데 살짝 쉬었다 부르면 대개 통과한다.
 */
export function loadRecentCandles(stockCode: string): Promise<Candle[]> {
  return withRetry(() => getRecentCandles(stockCode), 2, 400).then(dropUnsettled)
}
