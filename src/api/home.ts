import { getPrice, hasSessionData, toChangeRate, toVolume } from './market'
import { readQuoteSnapshot, saveQuoteSnapshot } from './quoteSnapshot'
import { loadCandles } from './candles'
import { STOCK_LIST } from './stockList'
import { daysAgo, toYmd } from '../utils/date'
import { delay, settleInChunks, withRetry } from '../utils/async'
import { readCache, writeCache } from '../utils/cache'
import type { Candle } from '../types/market'
import type {
  Quote,
  Stock,
  StockInfo,
  TopStock,
  TopTheme,
} from '../types/stock'

/** 테마 라벨과 종목 선정은 API에 없어 프론트에서 고정한다 */
export const TOP_THEMES: TopTheme[] = [
  { stockCode: '000660', stockName: 'SK하이닉스', theme: '기술주 대장' },
  { stockCode: '012450', stockName: '한화에어로스페이스', theme: '방산주 대장' },
  { stockCode: '207940', stockName: '삼성바이오로직스', theme: '바이오주 대장' },
]

/** 카드에 그리는 구간. 받아오는 구간과 별개다 (아래 toTopStock 설명 참고) */
const CARD_DAYS = 90

const TOP_CACHE_KEY = 'topStocks'
/** 90일 등락률이라 반나절 지난 값이어도 화면에 잠깐 띄우기엔 충분하다 */
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
 * 일봉이 건당 1.5~2.4초라 그렇게 두면 화면이 8초 넘게 비어 있었다.
 *
 * 동시에 던지면 매번 하나가 500으로 떨어지므로 순차로 보내되,
 * 붙여 보내도 걸리는 탓에 사이를 조금 띄운다(실측: 300ms면 실패 0).
 *
 * 일봉은 상세 화면과 같은 창구로 받는다. 카드에 필요한 건 90일치뿐이지만 따로 부르면
 * 카드를 눌렀을 때 방금 받은 종목을 처음부터 다시 받게 된다. 창구를 맞춰두면 그 요청이
 * 캐시에 그대로 남아 상세 화면이 즉시 열린다. 어차피 응답 시간은 요청 구간과 무관하다.
 */
export async function loadTopStocks(
  onEach: (index: number, stock: TopStock) => void,
): Promise<void> {
  const loaded: TopStock[] = []

  for (const [index, theme] of TOP_THEMES.entries()) {
    if (index > 0) await delay(300)

    const points = await loadCandles(theme.stockCode)
    if (points.length === 0) {
      throw new Error(`${theme.stockName} 일봉 데이터가 비어 있습니다`)
    }

    const stock = toTopStock(theme, points)
    loaded.push(stock)
    onEach(index, stock)
  }

  // 셋이 다 모였을 때만 저장한다. 반쯤 찬 카드를 다음 방문에 그려봐야 소용없다
  writeCache(TOP_CACHE_KEY, loaded)
}

/**
 * 카드는 "90일 전 대비"를 보여주는데 받아온 건 그보다 긴 구간이라 앞을 잘라낸다.
 * 날짜가 YYYYMMDD 문자열이라 사전순 비교가 곧 날짜순 비교다.
 */
function toTopStock(theme: TopTheme, points: Candle[]): TopStock {
  const since = toYmd(daysAgo(CARD_DAYS))
  const window = points.filter((point) => point.date >= since)
  // 90일 안에 든 봉이 등락률을 낼 수 없을 만큼 적으면 받은 걸 그대로 쓴다
  const recent = window.length >= 2 ? window : points

  const first = recent[0].close
  const last = recent[recent.length - 1].close

  return {
    ...theme,
    changeRate: ((last - first) / first) * 100,
    prices: recent.map((point) => point.close),
    volumes: recent.map((point) => point.volume),
  }
}

/**
 * 홈 종목 목록. 시세는 비워서 돌려준다.
 * 현재가 API가 종목당 1회 호출이라 102종목을 한 번에 부르면 6초 넘게 걸리고 일부는 실패한다.
 * 그래서 목록만 먼저 주고, 화면에 보이는 만큼만 getQuotes()로 채운다.
 * 백엔드 `GET /v1/home`이 생기면 이 함수가 시세까지 담아 반환하도록 바꾸면 된다.
 */
export async function getHomeStocks(): Promise<Stock[]> {
  return STOCK_LIST.map((stock) => ({
    ...stock,
    currentPrice: null,
    changeRate: null,
    volume: null,
  }))
}

export interface QuoteResult {
  quotes: Map<string, Quote>
  /** 지난 장 값을 대신 쓴 경우 그 장의 날짜(YYYYMMDD). 오늘 장 값이면 null */
  frozenDate: string | null
}

/**
 * 넘겨받은 종목들의 시세를 조회한다. 실패한 종목은 Map에 안 담기고 화면에 "-"로 남는다.
 * shouldStop은 홈을 떠났는지 묻는다. 참이면 남은 종목은 받지 않는다.
 *
 * 장이 열리기 전이면 증권사가 등락률과 거래량을 0으로 초기화해 보낸다.
 * 그때는 마지막으로 받아둔 장 값을 대신 돌려주고, 어느 장 기준인지 함께 알린다.
 */
export async function getQuotes(
  stocks: StockInfo[],
  shouldStop?: () => boolean,
): Promise<QuoteResult> {
  /*
   * 묶음 사이에 120ms를 쉰다. 쉬지 않고 101종목을 몰아치면 백엔드 호출 제한에 걸려
   * 60종목이 500으로 떨어졌다. 간격을 주면 8종목까지 줄고 그마저 withRetry가 대부분 건진다.
   */
  const results = await settleInChunks(
    stocks,
    5,
    (stock) => withRetry(() => getPrice(stock.stockCode)),
    120,
    shouldStop,
  )

  const quotes = new Map<string, Quote>()
  /* 한 종목이라도 시가가 잡혔으면 오늘 장이 열린 것이다 */
  let hasToday = false

  stocks.forEach((stock, index) => {
    const result = results[index]
    // 중간에 멈췄으면 뒤쪽은 결과 자체가 없다
    if (result === undefined) return
    if (result.status === 'rejected') {
      console.warn(`${stock.stockName} 현재가 조회 실패`, result.reason)
      return
    }

    const price = result.value
    // 거래정지 종목도 시가가 0이다. 오늘 값이 없는 건 마찬가지라 담지 않고 넘어간다
    if (!hasSessionData(price)) return

    hasToday = true
    quotes.set(stock.stockCode, {
      currentPrice: Number(price.stck_prpr),
      changeRate: toChangeRate(price),
      volume: toVolume(price),
    })
  })

  if (hasToday) {
    saveQuoteSnapshot(toYmd(new Date()), quotes)
    return { quotes, frozenDate: null }
  }

  /*
   * 오늘 장이 아직 없다. 마지막으로 받아둔 장 값을 그대로 보여준다.
   * 저장해둔 게 없으면(첫 방문이 장 시작 전이면) 빈 채로 둔다. 지어낼 값이 없다.
   */
  const snapshot = readQuoteSnapshot()
  if (snapshot === null) return { quotes, frozenDate: null }

  stocks.forEach((stock) => {
    const saved = snapshot.quotes[stock.stockCode]
    if (saved !== undefined) quotes.set(stock.stockCode, saved)
  })

  return { quotes, frozenDate: snapshot.date }
}
