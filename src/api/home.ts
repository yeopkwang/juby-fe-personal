import {
  getDailyChart,
  getPrice,
  getVolumeRank,
  toChangeRate,
  toTradingValue,
} from './market'
import { STOCK_LIST } from './stockList'
import { daysAgo, toYmd } from '../utils/date'
import { settleInChunks, withRetry } from '../utils/async'
import type { Quote, Stock, StockInfo, TopStock } from '../types/stock'

/** 테마 라벨과 종목 선정은 API에 없어 프론트에서 고정한다 */
const THEMES = [
  { stockCode: '000660', stockName: 'SK하이닉스', theme: '기술주 대장' },
  { stockCode: '012450', stockName: '한화에어로스페이스', theme: '방산주 대장' },
  { stockCode: '207940', stockName: '삼성바이오로직스', theme: '바이오주 대장' },
]

const CHART_DAYS = 90

/**
 * 진행 중이거나 완료된 조회를 재사용한다.
 * StrictMode는 개발 모드에서 effect를 두 번 실행하는데, 그대로 두면 일봉 요청이 6건으로 늘어
 * 서로 호출 제한에 걸린다. 같은 Promise를 돌려주면 실제 요청은 한 번만 나간다.
 */
let topStocksPromise: Promise<TopStock[]> | null = null

export function getTopStocks(): Promise<TopStock[]> {
  if (topStocksPromise === null) {
    topStocksPromise = fetchTopStocks().catch((error: unknown) => {
      // 실패는 캐시하지 않는다. 다음 진입 때 다시 시도할 수 있어야 한다
      topStocksPromise = null
      throw error
    })
  }

  return topStocksPromise
}

/**
 * 일봉은 한국투자증권 **모의투자** 서버를 거치는데 호출 제한이 유난히 빡빡하다.
 * 3종목을 동시에 던지면 매번 하나가 500으로 떨어지고, 순차로 붙여 보내도 마찬가지다.
 * 실측 결과 1.5초 간격이면 실패율이 5% 수준으로 떨어져서 간격과 재시도를 함께 둔다.
 */
async function fetchTopStocks(): Promise<TopStock[]> {
  const endDate = toYmd(new Date())
  const startDate = toYmd(daysAgo(CHART_DAYS))

  const results = await settleInChunks(
    THEMES,
    1,
    (theme) =>
      withRetry(
        () => getDailyChart(theme.stockCode, startDate, endDate),
        2,
        1000,
      ),
    800,
  )

  return THEMES.map((theme, index) => {
    const result = results[index]

    if (result.status === 'rejected') {
      throw new Error(`${theme.stockName} 일봉 조회 실패`)
    }
    if (result.value.length === 0) {
      throw new Error(`${theme.stockName} 일봉 데이터가 비어 있습니다`)
    }

    const points = result.value
    const first = points[0].close
    const last = points[points.length - 1].close

    return {
      ...theme,
      changeRate: ((last - first) / first) * 100,
      prices: points.map((point) => point.close),
      volumes: points.map((point) => point.volume),
    }
  })
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
    tradingValue: null,
    isTradingValueEstimated: false,
  }))
}

/** 넘겨받은 종목들의 시세를 조회한다. 실패한 종목은 Map에 안 담기고 화면에 "-"로 남는다 */
export async function getQuotes(
  stocks: StockInfo[],
): Promise<Map<string, Quote>> {
  const tradingValues = await getTradingValueByName()
  const results = await settleInChunks(stocks, 5, (stock) =>
    withRetry(() => getPrice(stock.stockCode)),
  )

  const quotes = new Map<string, Quote>()

  stocks.forEach((stock, index) => {
    const result = results[index]
    if (result.status === 'rejected') {
      console.warn(`${stock.stockName} 현재가 조회 실패`, result.reason)
      return
    }

    // 거래대금 순위(상위 30)에 든 종목은 실제값을, 나머지는 추정값을 쓴다
    const exact = tradingValues.get(stock.stockName) ?? null
    const estimate = exact === null ? toTradingValue(result.value) : null

    quotes.set(stock.stockCode, {
      currentPrice: Number(result.value.stck_prpr),
      changeRate: toChangeRate(result.value),
      tradingValue: exact ?? estimate,
      isTradingValueEstimated: estimate !== null,
    })
  })

  return quotes
}

/**
 * 종목명 → 거래대금.
 * 거래대금 상위 30종목만 내려오므로 순위 밖 종목은 값이 없다.
 * 스크롤할 때마다 다시 부를 필요는 없어 한 번만 조회하고 재사용한다.
 */
let tradingValueCache: Map<string, number> | null = null

async function getTradingValueByName(): Promise<Map<string, number>> {
  if (tradingValueCache !== null) return tradingValueCache

  try {
    const ranks = await getVolumeRank()
    tradingValueCache = new Map(
      ranks.map((rank) => [rank.hts_kor_isnm, Number(rank.avrg_tr_pbmn)]),
    )
  } catch (error) {
    console.warn('거래량 순위 조회 실패. 거래대금을 "-"로 표시합니다.', error)
    tradingValueCache = new Map()
  }

  return tradingValueCache
}

