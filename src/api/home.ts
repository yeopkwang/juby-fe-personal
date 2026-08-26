import { getPrice, hasSessionData, toChangeRate, toVolume } from './market'
import { readQuoteSnapshot, saveQuoteSnapshot } from './quoteSnapshot'
import { loadRecentCandles } from './candles'
import { STOCK_LIST } from './stockList'
import { toYmd } from '../utils/date'
import { delay, settleInChunks, withRetry } from '../utils/async'
import { readCache, writeCache } from '../utils/cache'
import { BlockedPathError, UserFacingError } from '../utils/error'
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

/** 카드 사이에 쉬는 시간. 붙여 보내면 초당 제한에 걸린다. 200ms면 셋이 0.5초 안쪽 */
const CARD_REQUEST_GAP = 200

const TOP_CACHE_KEY = 'topStocks'
/** 6주 등락률이라 반나절 지난 값이어도 화면에 잠깐 띄우기엔 충분하다 */
const TOP_CACHE_MAX_AGE = 12 * 60 * 60 * 1000

/** 지난 방문에서 받아둔 카드. 띄운 뒤에도 loadTopStocks()가 돌아 최신 값으로 갈아끼운다 */
export function readCachedTopStocks(): TopStock[] | null {
  const cached = readCache<TopStock[]>(TOP_CACHE_KEY, TOP_CACHE_MAX_AGE)
  // 테마 구성이 바뀌었으면 자리 수가 안 맞는다. 그럴 땐 없는 셈 친다
  return cached === null || cached.length !== TOP_THEMES.length ? null : cached
}

/**
 * 테마별 대표 종목을 하나씩 조회해 받는 대로 넘긴다.
 * 셋을 모아 한 번에 주면 가장 느린 하나에 카드 세 장이 전부 묶인다.
 *
 * 일봉은 최근 30거래일만 받는다. 예전에는 상세와 같은 창구(1년치, 건당 1.5~2.4초)라
 * 카드 셋이 다 차는 데 5~8초가 걸렸다. 지금은 실전 서버 쪽(60ms)이다.
 *
 * 동시에 던지면 초당 제한(EGW00201)에 걸려 셋 중 둘이 500으로 떨어져서 사이를 띄운다.
 * 한 장이 실패해도 멈추지 않는다 — 예전에는 첫 장에서 throw해서 한 종목이 거래정지면
 * 멀쩡한 나머지 두 장까지 시도조차 못 했다.
 */
export async function loadTopStocks(
  onEach: (index: number, stock: TopStock) => void,
): Promise<void> {
  const loaded: TopStock[] = []
  /**
   * 마지막으로 본 실패. 한 장도 못 받았을 때 이걸 그대로 다시 던진다.
   * 뭉뚱그린 새 에러를 만들면 종류가 지워져 '다시 시도'를 내밀지 판단할 근거를 잃는다.
   */
  let lastError: unknown = null

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
      lastError = error
      // 경로가 막힌 것이면 남은 카드도 같은 창구라 결과가 같다. 간격만 태우지 않는다
      if (error instanceof BlockedPathError) break
    }
  }

  // 셋이 다 모였을 때만 저장한다. 반쯤 찬 카드를 다음 방문에 그려봐야 소용없다
  if (loaded.length === TOP_THEMES.length) {
    writeCache(TOP_CACHE_KEY, loaded)
    return
  }

  // 한 장도 못 받았을 때만 실패로 알린다. 부르는 쪽이 에러 화면으로 바꾼다
  if (loaded.length === 0) {
    throw (
      lastError ??
      new UserFacingError('테마별 대표 종목을 한 건도 받지 못했습니다')
    )
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
 * 현재가 API가 종목당 1회 호출이라 102종목을 몰아 부르면 6초 넘게 걸리고 일부는 실패한다.
 * 목록을 먼저 주고 화면에 보이는 만큼만 getQuotes()로 채운다. 빈 표를 먼저 그리면
 * 몇 초간 '-'만 남으므로, 저장해 둔 값이 있으면 그걸로 채워서 내보낸다.
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
  /**
   * 한 건도 못 받았을 때 그 원인. 하나라도 받았으면 null.
   *
   * 예전에는 종목별 실패를 console.warn으로 흘리고 끝냈다. 표는 "-"로 채워지지만
   * **화면이 왜 비었는지 말할 근거가 없어서** 그냥 비워 뒀고, 사용자는 자기 인터넷을
   * 의심했다. 종류를 그대로 들고 와야 utils/error.ts가 원인을 문장으로 옮길 수 있다.
   *
   * 처음 걸린 것 하나만 든다 — 102개가 같은 이유로 실패해도 사용자에게는 한 문장이면
   * 되고, 서로 다른 이유로 실패했다면 그중 무엇을 골라도 대표성은 비슷하다.
   */
  failure: unknown
}

/** settleInChunks 결과에서 처음 실패한 이유 하나. 전부 성공했으면 null */
function firstFailure(results: PromiseSettledResult<unknown>[]): unknown {
  const rejected = results.find((result) => result.status === 'rejected')
  return rejected === undefined ? null : rejected.reason
}

/**
 * 한 번 물어본 결과를 잠깐 붙들어 둔다. 표가 20종목과 나머지를 나눠 부르므로
 * getQuotes가 한 화면에서 두 번 도는데, 그때마다 다시 물으면 호출을 세 건씩 더 쓴다.
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
 * 몇 종목만 찔러 장 개시를 확인한다. 닫혀 있으면 102종목 전부가 0으로 오는데,
 * 그걸 다 부르고 나서야 헛수고였음을 아는 대신 세 건으로 먼저 묻는다.
 * 한 종목만 묻지 않는 건 거래정지 종목도 시가가 0이라서다.
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
 * 확정된 값이라 장 시간과 무관하게 언제나 채워져 있다. 종가를 현재가로, 등락률은
 * 마지막 봉과 그 앞 봉의 종가로 계산한다. 예전에는 저장해 둔 값을 꺼내 써서
 * 첫 방문(주말·장 시작 전)에는 표 전체가 '-'였다.
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

  return {
    quotes,
    frozenDate: latestDate,
    failure: quotes.size > 0 ? null : firstFailure(results),
  }
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
  if (stocks.length === 0)
    return { quotes: new Map(), frozenDate: null, failure: null }

  /* 닫힌 장에 102종목 현재가를 부르는 건 전부 0을 받으려고 기다리는 것과 같다 */
  if (!(await isSessionOpen(stocks))) {
    const daily = await getQuotesFromDaily(stocks, shouldStop)
    return daily.quotes.size > 0 ? daily : fromSnapshot(stocks, daily.failure)
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
    return { quotes, frozenDate: null, failure: null }
  }

  /*
   * 장이 열려 있다고 보고 물어봤는데 쓸 값이 하나도 안 왔다.
   * 확정값 쪽으로 한 번 더 시도하고, 그마저 비면 저장해 둔 지난 값을 꺼낸다.
   */
  const daily = await getQuotesFromDaily(stocks, shouldStop)
  if (daily.quotes.size > 0) return daily

  /* 현재가 쪽 실패가 더 뿌리에 가깝다. 그게 없을 때만(=장이 그냥 닫힌 경우) 일봉 쪽을 쓴다 */
  return fromSnapshot(stocks, firstFailure(results) ?? daily.failure)
}

/**
 * 마지막 수단. 지난 방문에서 저장해 둔 장 값을 꺼낸다.
 * 저장해 둔 게 없으면 빈 채로 둔다 — 지어낼 값이 없다.
 */
function fromSnapshot(stocks: StockInfo[], failure: unknown): QuoteResult {
  const quotes = new Map<string, Quote>()
  const snapshot = readQuoteSnapshot()
  if (snapshot === null) return { quotes, frozenDate: null, failure }

  stocks.forEach((stock) => {
    const saved = snapshot.quotes[stock.stockCode]
    if (saved !== undefined) quotes.set(stock.stockCode, saved)
  })

  return {
    quotes,
    frozenDate: snapshot.date,
    failure: quotes.size > 0 ? null : failure,
  }
}
