import { getStockDetail } from './stock'
import { delay, withRetry } from '../utils/async'
import { readCache, writeCache } from '../utils/cache'
import type { Candle, TopStock, TopTheme } from '../types/stock'

/** 테마 라벨과 종목 선정은 API에 없어 프론트에서 고정한다 */
export const TOP_THEMES: TopTheme[] = [
  { stockCode: '000660', stockName: 'SK하이닉스', theme: '기술주 대장' },
  { stockCode: '012450', stockName: '한화에어로스페이스', theme: '방산주 대장' },
  { stockCode: '207940', stockName: '삼성바이오로직스', theme: '바이오주 대장' },
]

/**
 * 카드 사이에 쉬는 시간.
 *
 * 상세 API는 일봉을 DB에서 주지만 현재가 하나는 증권사에 물어보므로, 세 장을 동시에
 * 던지면 초당 제한(EGW00201)에 걸려 500이 섞인다. 순차로 보내되 잠깐 띄운다.
 */
const CARD_REQUEST_GAP = 200

const TOP_CACHE_KEY = 'topStocks'
/** 한 달 등락률이라 반나절 지난 값이어도 화면에 잠깐 띄우기엔 충분하다 */
const TOP_CACHE_MAX_AGE = 12 * 60 * 60 * 1000

/**
 * 지난번 방문에서 받아둔 카드. 첫 그림을 즉시 그리는 용도다.
 * 이 값을 띄운 뒤에도 loadTopStocks()는 그대로 돌아 최신 값으로 갈아끼운다.
 */
export function readCachedTopStocks(): TopStock[] | null {
  const cached = readCache<TopStock[]>(TOP_CACHE_KEY, TOP_CACHE_MAX_AGE)
  // 테마 구성이 바뀌었으면 자리 수가 안 맞는다. 그럴 땐 없는 셈 친다
  return cached === null || cached.length !== TOP_THEMES.length ? null : cached
}

/**
 * 테마별 대표 종목을 하나씩 조회해 받는 대로 넘긴다.
 *
 * 셋을 모아 한 번에 주면 가장 느린 하나에 카드 세 장이 전부 묶인다.
 * 받는 대로 넘겨야 첫 장이 먼저 뜬다.
 *
 * 한 장이 실패해도 멈추지 않는다. 한 종목이 거래정지이거나 하필 그 요청만 제한에
 * 걸린 경우, 멀쩡한 나머지 두 장까지 시도조차 못 하고 통째로 에러가 되면 안 된다.
 */
export async function loadTopStocks(
  onEach: (index: number, stock: TopStock) => void,
): Promise<void> {
  const loaded: TopStock[] = []

  for (const [index, theme] of TOP_THEMES.entries()) {
    if (index > 0) await delay(CARD_REQUEST_GAP)

    try {
      const detail = await withRetry(
        () => getStockDetail(theme.stockCode, 'ONE_MONTH'),
        1,
        400,
      )
      if (detail.candles.length === 0) {
        throw new Error('일봉 데이터가 비어 있습니다')
      }

      const stock = toTopStock(theme, detail.candles)
      loaded.push(stock)
      onEach(index, stock)
    } catch (error: unknown) {
      console.warn(`${theme.stockName} 카드 조회 실패`, error)
    }
  }

  // 셋이 다 모였을 때만 저장한다. 반쯤 찬 카드를 다음 방문에 그려봐야 소용없다
  if (loaded.length === TOP_THEMES.length) {
    writeCache(TOP_CACHE_KEY, loaded)
    return
  }

  // 한 장도 못 받았을 때만 실패로 알린다. 부르는 쪽이 에러 화면으로 바꾼다
  if (loaded.length === 0) {
    throw new Error('테마별 대표 종목을 한 건도 받지 못했습니다')
  }
}

/** 받아온 1개월치를 그대로 쓴다 */
function toTopStock(theme: TopTheme, points: Candle[]): TopStock {
  const first = points[0].close
  const last = points[points.length - 1].close

  return {
    ...theme,
    // 거래정지 등으로 첫 종가가 0이면 나눌 수 없다. 보합으로 둔다
    changeRate: first === 0 ? 0 : ((last - first) / first) * 100,
    prices: points.map((point) => point.close),
    volumes: points.map((point) => point.volume),
  }
}
