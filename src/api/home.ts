import { getPrice, hasSessionData, toChangeRate, toVolume } from './market'
import { readQuoteSnapshot, saveQuoteSnapshot } from './quoteSnapshot'
import { loadRecentCandles } from './candles'
import { STOCK_LIST } from './stockList'
import { toYmd } from '../utils/date'
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

/**
 * 카드 사이에 쉬는 시간.
 * 붙여 보내면 증권사 초당 제한에 걸린다. 200ms면 셋을 다 받아도 0.5초 안쪽이다.
 */
const CARD_REQUEST_GAP = 200

const TOP_CACHE_KEY = 'topStocks'
/** 6주 등락률이라 반나절 지난 값이어도 화면에 잠깐 띄우기엔 충분하다 */
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
 * **일봉은 최근 30거래일만 받는다(loadRecentCandles).**
 * 예전에는 상세 화면과 같은 창구(1년치, 건당 1.5~2.4초)를 써서 카드 셋이 다 차는 데
 * 5~8초가 걸렸다. 카드에 필요한 건 최근 흐름뿐이라 실전 서버 쪽(60ms)으로 바꿨다.
 *
 * 상세 화면 캐시를 데워주던 효과는 사라지지만, 카드에 마우스를 올리면
 * TopStockCard가 prefetchCandles로 1년치를 미리 받아두므로 실제 체감은 그대로다.
 *
 * 동시에 던지면 증권사 초당 제한(EGW00201)에 걸려 셋 중 둘이 500으로 떨어진다.
 * 순차로 보내되 사이를 띄운다. 건당이 짧아 셋을 합쳐도 1초 안쪽이다.
 *
 * 한 장이 실패해도 멈추지 않는다. 예전에는 첫 장에서 그대로 throw해서
 * 한 종목이 상장폐지·거래정지이거나 하필 그 요청만 제한에 걸린 경우
 * 멀쩡한 나머지 두 장까지 시도조차 못 하고 통째로 에러 화면이 됐다.
 */
export async function loadTopStocks(
  onEach: (index: number, stock: TopStock) => void,
): Promise<void> {
  const loaded: TopStock[] = []

  for (const [index, theme] of TOP_THEMES.entries()) {
    if (index > 0) await delay(CARD_REQUEST_GAP)

    try {
      const points = await loadRecentCandles(theme.stockCode)
      if (points.length === 0) {
        throw new Error('일봉 데이터가 비어 있습니다')
      }

      const stock = toTopStock(theme, points)
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

/** 받아온 30거래일을 그대로 쓴다. 구간을 고를 수 없는 API라 자를 것이 없다 */
function toTopStock(theme: TopTheme, points: Candle[]): TopStock {
  const first = points[0].close
  const last = points[points.length - 1].close

  return {
    ...theme,
    changeRate: ((last - first) / first) * 100,
    prices: points.map((point) => point.close),
    volumes: points.map((point) => point.volume),
  }
}

export interface HomeStocks {
  stocks: Stock[]
  /** 채워 넣은 값이 어느 장 기준인지. 저장해 둔 게 없으면 null */
  frozenDate: string | null
}

/**
 * 홈 종목 목록.
 *
 * 현재가 API가 종목당 1회 호출이라 102종목을 한 번에 부르면 6초 넘게 걸리고 일부는 실패한다.
 * 그래서 목록을 먼저 주고, 화면에 보이는 만큼만 getQuotes()로 채운다.
 *
 * 다만 빈 표를 먼저 그리면 값이 도착할 때까지 몇 초간 '-'만 남는다.
 * 지난 방문에서 저장해 둔 값이 있으면 그걸로 채워서 내보낸다. 기다림 없이 숫자가 보이고,
 * getQuotes()가 최신 값을 받아 같은 자리에 갈아끼운다(카드가 topStocks 캐시를 쓰는 것과 같다).
 *
 * 백엔드 `GET /v1/home`이 생기면 이 함수가 시세까지 담아 반환하도록 바꾸면 된다.
 */
export async function getHomeStocks(): Promise<HomeStocks> {
  const snapshot = readQuoteSnapshot()

  const stocks = STOCK_LIST.map((stock) => {
    const saved = snapshot?.quotes[stock.stockCode]
    return {
      ...stock,
      currentPrice: saved?.currentPrice ?? null,
      changeRate: saved?.changeRate ?? null,
      volume: saved?.volume ?? null,
    }
  })

  return { stocks, frozenDate: snapshot?.date ?? null }
}

export interface QuoteResult {
  quotes: Map<string, Quote>
  /** 지난 장 값을 대신 쓴 경우 그 장의 날짜(YYYYMMDD). 오늘 장 값이면 null */
  frozenDate: string | null
}

/**
 * 한 번 물어본 결과를 잠깐 붙들어 둔다.
 *
 * 표는 보이는 20종목과 나머지를 나눠 부르므로 getQuotes가 한 화면에서 두 번 돈다.
 * 그때마다 다시 물으면 귀한 호출을 세 건씩 더 쓴다.
 * 화면을 열어둔 채 장이 열리는 경우가 있으니 오래 붙들지는 않는다.
 */
let sessionProbe: { at: number; result: Promise<boolean> } | null = null
const SESSION_PROBE_MAX_AGE = 60_000

/** 장이 열려 있는가. 값 출처를 현재가로 할지 확정된 일봉으로 할지 이걸로 가른다 */
function isSessionOpen(stocks: StockInfo[]): Promise<boolean> {
  const now = Date.now()
  if (sessionProbe !== null && now - sessionProbe.at < SESSION_PROBE_MAX_AGE) {
    return sessionProbe.result
  }

  const result = probeSession(stocks)
  sessionProbe = { at: now, result }
  return result
}

/**
 * 몇 종목만 찔러 장 개시를 확인한다.
 *
 * 닫혀 있으면 현재가 API는 102종목 전부를 0으로 돌려준다. 그걸 다 부르고 나서야
 * 헛수고였음을 아는 대신, 세 건으로 먼저 묻고 확정값 쪽으로 방향을 튼다.
 *
 * 한 종목만 묻지 않는 이유는 거래정지 종목도 시가가 0이기 때문이다.
 * 셋 중 하나라도 시가가 잡히면 장이 열린 것이다.
 */
async function probeSession(stocks: StockInfo[]): Promise<boolean> {
  const probes = await settleInChunks(stocks.slice(0, 3), 3, (stock) =>
    withRetry(() => getPrice(stock.stockCode)),
  )

  return probes.some(
    (probe) => probe.status === 'fulfilled' && hasSessionData(probe.value),
  )
}

/**
 * 장이 닫혔을 때 쓰는 길. 최근 30거래일 일봉에서 마지막 장 값을 꺼낸다.
 *
 * 현재가 API와 달리 **확정된 값이라 장 시간과 무관하게 언제나 채워져 있다.**
 * 종가를 현재가로, 거래량은 그 장의 누적 거래량을 그대로 쓰고,
 * 등락률은 마지막 봉과 그 앞 봉의 종가로 직접 계산한다.
 *
 * 예전에는 이 자리에서 localStorage에 저장해 둔 지난 값을 꺼내 썼는데,
 * 저장해 둔 게 없는 첫 방문(주말·장 시작 전)에는 표 전체가 '-'로 남았다.
 * 이제는 API로 바로 받아오므로 첫 방문에도 값이 뜬다.
 */
async function getQuotesFromDaily(
  stocks: StockInfo[],
  shouldStop?: () => boolean,
): Promise<QuoteResult> {
  const results = await settleInChunks(
    stocks,
    5,
    (stock) => loadRecentCandles(stock.stockCode),
    120,
    shouldStop,
  )

  const quotes = new Map<string, Quote>()
  /** 받아온 것 중 가장 최근 장의 날짜. 어느 장 기준인지 화면에 적는 데 쓴다 */
  let latestDate: string | null = null

  stocks.forEach((stock, index) => {
    const result = results[index]
    // 중간에 멈췄으면 뒤쪽은 결과 자체가 없다
    if (result === undefined) return
    if (result.status === 'rejected') {
      console.warn(`${stock.stockName} 일봉 조회 실패`, result.reason)
      return
    }

    const candles = result.value
    if (candles.length === 0) return

    const last = candles[candles.length - 1]
    // 봉이 하나뿐이면 비교 대상이 없다. 등락률은 보합으로 둔다
    const previous = candles.at(-2)

    quotes.set(stock.stockCode, {
      currentPrice: last.close,
      changeRate:
        previous === undefined
          ? 0
          : ((last.close - previous.close) / previous.close) * 100,
      // 거래정지 종목은 0이 온다. "0주"로 적히지 않게 없는 값으로 둔다
      volume: last.volume > 0 ? last.volume : null,
    })

    if (latestDate === null || last.date > latestDate) latestDate = last.date
  })

  /*
   * 마감된 확정값이라 다음 장이 열릴 때까지 절대 변하지 않는다.
   * 저장해 두면 주말에 다시 들어왔을 때 표가 기다림 없이 채워진 채로 뜬다.
   */
  if (latestDate !== null) saveQuoteSnapshot(latestDate, quotes)

  return { quotes, frozenDate: latestDate }
}

/**
 * 넘겨받은 종목들의 시세를 조회한다. 실패한 종목은 Map에 안 담기고 화면에 "-"로 남는다.
 * shouldStop은 홈을 떠났는지 묻는다. 참이면 남은 종목은 받지 않는다.
 *
 * 장이 열려 있으면 현재가 API를, 닫혀 있으면 일봉의 마지막 장 값을 쓴다.
 * 어느 쪽이든 값이 하나도 안 잡히면 마지막 수단으로 저장해 둔 지난 값을 꺼낸다.
 */
export async function getQuotes(
  stocks: StockInfo[],
  shouldStop?: () => boolean,
): Promise<QuoteResult> {
  if (stocks.length === 0) return { quotes: new Map(), frozenDate: null }

  /* 닫힌 장에 102종목 현재가를 부르는 건 전부 0을 받으려고 기다리는 것과 같다 */
  if (!(await isSessionOpen(stocks))) {
    const daily = await getQuotesFromDaily(stocks, shouldStop)
    return daily.quotes.size > 0 ? daily : fromSnapshot(stocks)
  }

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
   * 장이 열려 있다고 보고 물어봤는데 쓸 값이 하나도 안 왔다.
   * 확정값 쪽으로 한 번 더 시도하고, 그마저 비면 저장해 둔 지난 값을 꺼낸다.
   */
  const daily = await getQuotesFromDaily(stocks, shouldStop)
  return daily.quotes.size > 0 ? daily : fromSnapshot(stocks)
}

/**
 * 마지막 수단. 지난 방문에서 저장해 둔 장 값을 꺼낸다.
 * 저장해 둔 게 없으면 빈 채로 둔다 — 지어낼 값이 없다.
 */
function fromSnapshot(stocks: StockInfo[]): QuoteResult {
  const quotes = new Map<string, Quote>()
  const snapshot = readQuoteSnapshot()
  if (snapshot === null) return { quotes, frozenDate: null }

  stocks.forEach((stock) => {
    const saved = snapshot.quotes[stock.stockCode]
    if (saved !== undefined) quotes.set(stock.stockCode, saved)
  })

  return { quotes, frozenDate: snapshot.date }
}
