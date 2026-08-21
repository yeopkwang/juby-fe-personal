import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import LoadFailure from '../components/LoadFailure'
import SearchBar from '../components/SearchBar'
import TopStockCard from '../components/TopStockCard'
import StockTable from '../components/StockTable'
import Modal from '../components/Modal'
import {
  TOP_THEMES,
  getHomeStocks,
  getQuotes,
  loadTopStocks,
  readCachedTopStocks,
} from '../api/home'
import { delay } from '../utils/async'
import { isLoggedIn } from '../utils/auth'
import { toKoreanDate } from '../utils/date'
import { isRetryable, toUserMessage } from '../utils/error'
import { nextSort, sortStocks } from '../utils/sort'
import type { SortKey, SortState, Stock, TopStock } from '../types/stock'
import styles from './HomePage.module.css'

const PAGE_SIZE = 20

/**
 * 시세 루프가 카드를 기다려 주는 최대 시간.
 * 카드 세 건이 정상이면 0.5초 안에 끝난다. 그보다 오래 걸리면 백엔드가 아픈 것이므로
 * 표까지 붙잡혀 있을 이유가 없다.
 */
const CARD_HEAD_START = 1200

export default function HomePage() {
  /*
   * 지난 방문에서 받아둔 카드가 있으면 그걸로 시작한다. 없으면 자리만 잡아 둔다.
   * 어느 쪽이든 아래 effect가 최신 값을 받아 같은 자리에 갈아끼운다.
   */
  const [topStocks, setTopStocks] = useState<(TopStock | null)[]>(
    () => readCachedTopStocks() ?? TOP_THEMES.map(() => null),
  )
  /** 카드를 한 장도 못 받았을 때 적을 한 문장. 잘 받았으면 null */
  const [topErrorMessage, setTopErrorMessage] = useState<string | null>(null)
  /** 다시 눌러 볼 만한 실패였는가. 막힌 경로면 눌러도 결과가 같아 버튼을 안 그린다 */
  const [canRetryTop, setCanRetryTop] = useState(false)
  const [isRetryingTop, setIsRetryingTop] = useState(false)
  const [stocks, setStocks] = useState<Stock[]>([])
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [sort, setSort] = useState<SortState | null>(null)
  const [isSortLoading, setIsSortLoading] = useState(false)
  /** 관심종목. 등록 API가 없어 아직 화면 안에서만 유지된다 */
  const [favoriteCodes, setFavoriteCodes] = useState<Set<string>>(new Set())
  /** 장 시작 전이라 지난 장 값을 보여주는 중이면 그 날짜. 표 옆에 기준일을 적는다 */
  const [frozenDate, setFrozenDate] = useState<string | null>(null)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

  /** 이미 시세를 요청한 종목코드. 실패한 종목을 무한히 다시 부르는 걸 막는다 */
  const requestedCodes = useRef(new Set<string>())
  const sentinelRef = useRef<HTMLDivElement>(null)

  /** 전체 시세를 받는 중인 작업. 정렬을 누르면 이게 끝나기를 기다린다 */
  const allQuotesRef = useRef<Promise<void> | null>(null)
  /** 카드 조회 작업. 시세 루프가 이게 끝나기를 기다렸다가 출발한다 */
  const topStocksRef = useRef<Promise<void> | null>(null)
  const hasStartedQuotes = useRef(false)
  const hasStartedTop = useRef(false)
  const [isQuotesReady, setIsQuotesReady] = useState(false)

  /*
   * 홈을 떠났는지 알린다. 상세 화면으로 넘어가도 시세 루프는 계속 도는데,
   * 그 요청들이 호출 제한을 채우는 바람에 차트 요청이 뒤로 밀려 500을 맞고 재시도한다.
   * 떠나는 순간 남은 묶음을 버리면 차트가 먼저 나간다.
   *
   * 개발 모드는 마운트를 두 번 하므로 시작할 때 반드시 되돌려 놓는다.
   */
  const hasLeft = useRef(false)

  useEffect(() => {
    hasLeft.current = false
    return () => {
      hasLeft.current = true
    }
  }, [])

  /**
   * 카드 세 장을 받는다. 처음 한 번과 '다시 시도'가 같은 길로 지나간다.
   *
   * 실패의 종류를 그대로 들고 와야(`isRetryable`) 버튼을 내밀지 말지 정할 수 있다.
   * 지금 이 경로(`/api/market/**`)는 허용 목록에 없어서 몇 번을 눌러도 결과가 같은데,
   * 그때 '다시 시도'를 보여주면 사용자는 자기 인터넷을 의심하며 계속 누르게 된다.
   */
  const startTopStocks = useCallback(() => {
    setTopErrorMessage(null)

    topStocksRef.current = loadTopStocks((index, stock) => {
      setTopStocks((previous) =>
        previous.map((item, i) => (i === index ? stock : item)),
      )
    })
      .catch((error: unknown) => {
        console.warn('테마별 대표 종목 조회 실패', error)
        setTopErrorMessage(toUserMessage(error, '대표 종목을 찾지 못했습니다'))
        setCanRetryTop(isRetryable(error))
      })
      .finally(() => {
        setIsRetryingTop(false)
      })
  }, [])

  useEffect(() => {
    // 개발 모드는 effect를 두 번 실행한다. 그대로 두면 일봉 요청이 6건이 되어 서로 제한에 걸린다
    if (hasStartedTop.current) return
    hasStartedTop.current = true

    startTopStocks()
  }, [startTopStocks])

  function handleTopRetry() {
    setIsRetryingTop(true)
    startTopStocks()
  }

  useEffect(() => {
    /* 저장해 둔 값이 있으면 표가 처음부터 채워진 채로 뜬다. 없으면 '-'로 시작한다 */
    getHomeStocks().then((home) => {
      setStocks(home.stocks)
      setFrozenDate(home.frozenDate)
    })
  }, [])

  const loadQuotes = useCallback(async (targets: Stock[]) => {
    const fresh = targets.filter(
      (stock) => !requestedCodes.current.has(stock.stockCode),
    )
    if (fresh.length === 0) return

    fresh.forEach((stock) => requestedCodes.current.add(stock.stockCode))
    const { quotes, frozenDate: frozen } = await getQuotes(
      fresh,
      () => hasLeft.current,
    )

    setFrozenDate(frozen)
    setStocks((previous) =>
      previous.map((stock) => {
        const quote = quotes.get(stock.stockCode)
        return quote === undefined ? stock : { ...stock, ...quote }
      }),
    )
  }, [])

  /*
   * 보이는 20개를 먼저 채워 표를 띄우고, 나머지는 뒤에서 마저 받는다.
   * 예전에는 정렬을 누른 뒤에야 나머지를 불러서 3초 넘게 멈춰 있었다.
   *
   * stocks는 loadQuotes가 시세를 채울 때마다 새 배열이 되므로 이 effect가 다시 돈다.
   * ref로 한 번만 시작하게 막는다(개발 모드에서 effect를 두 번 실행하는 것도 같이 막힌다).
   */
  useEffect(() => {
    if (stocks.length === 0) return
    if (hasStartedQuotes.current) return
    hasStartedQuotes.current = true

    allQuotesRef.current = (async () => {
      /*
       * 카드가 먼저 나오도록 길을 비켜주되, 기다리는 시간에 반드시 상한을 둔다.
       *
       * 둘 다 증권사 초당 호출 제한을 함께 쓴다. 동시에 출발하면 102종목 쪽이 창구를
       * 가득 채워서, 세 건이면 끝날 카드가 500을 맞고 재시도하느라 몇 초씩 늦어졌다.
       *
       * 그렇다고 카드를 무작정 기다리면 안 된다. 백엔드가 응답을 멈췄을 때
       * 카드 요청이 안 끝나는 바람에 표가 시세를 아예 한 번도 요청하지 못했고,
       * 그래서 실패했을 때 쓰라고 만들어 둔 대체 값까지 못 쓰고 전부 '-'로 남았다.
       * 카드는 세 건이라 정상이면 0.5초면 끝난다. 넘어가면 그냥 같이 달린다.
       */
      await Promise.race([topStocksRef.current, delay(CARD_HEAD_START)])

      /*
       * finally로 감싸는 이유는 아래 두 가지가 이 한 줄에 매달려 있기 때문이다.
       * ① 표의 빈 칸이 회색 판(오는 중)에서 "-"(없음)로 넘어가는 시점,
       * ② 정렬 버튼이 기다리는 대상(handleSort의 await).
       * 여기서 예외가 새면 표는 영원히 오는 중이고 정렬은 영원히 잠긴다.
       */
      try {
        await loadQuotes(stocks.slice(0, PAGE_SIZE))
        await loadQuotes(stocks)
      } finally {
        setIsQuotesReady(true)
      }
    })()
  }, [stocks, loadQuotes])

  // 목록 끝이 화면에 들어오면 20개 더 보여준다
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (sentinel === null) return
    if (visibleCount >= stocks.length) return

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount((count) => count + PAGE_SIZE)
      }
    })

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [visibleCount, stocks.length])

  async function handleSort(key: SortKey) {
    // 시세 기준 정렬은 101종목 값이 다 있어야 맞다. 아직 받는 중이면 끝날 때까지만 기다린다
    if (key !== 'stockName' && !isQuotesReady) {
      setIsSortLoading(true)
      await allQuotesRef.current
      setIsSortLoading(false)
    }

    setSort((current) => nextSort(current, key))
    setVisibleCount(PAGE_SIZE)
  }

  function handleHeartClick(stockCode: string) {
    if (!isLoggedIn()) {
      setIsLoginModalOpen(true)
      return
    }

    setFavoriteCodes((previous) => {
      // Set을 직접 고치면 React가 같은 객체로 보고 다시 그리지 않는다. 복사본을 만든다
      const next = new Set(previous)
      if (next.has(stockCode)) next.delete(stockCode)
      else next.add(stockCode)
      return next
    })
  }

  const sortedStocks = sort === null ? stocks : sortStocks(stocks, sort)

  return (
    <>
      <SearchBar />

      <section className={styles.section}>
        <p className={styles.eyebrow}>백테스트 기법으로 투자한 (??? 멘트 수정예정 - 광엽)</p>
        {/* 홈의 대표 제목. 아래 '현재 주가 보기'가 h2로 이어진다 */}
        <h1 className={styles.heading}>테마별 대표 종목</h1>

        {/* 한 장도 못 받았을 때만 에러로 대체한다. 일부라도 왔으면 그건 보여주는 편이 낫다 */}
        {topErrorMessage !== null &&
        topStocks.every((stock) => stock === null) ? (
          <LoadFailure
            message={topErrorMessage}
            onRetry={canRetryTop ? handleTopRetry : undefined}
            isRetrying={isRetryingTop}
          />
        ) : (
          <div className={styles.cards}>
            {TOP_THEMES.map((theme, index) => (
              <TopStockCard
                key={theme.stockCode}
                theme={theme}
                stock={topStocks[index]}
              />
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.headingRow}>
          <h2 className={styles.heading}>현재 주가 보기</h2>
          {/* 장 시작 전에는 지난 장 값이 그대로 떠 있다. 언제 것인지 밝혀둔다 */}
          {frozenDate !== null && (
            <span className={styles.asOf}>
              {toKoreanDate(frozenDate)} 장 마감 기준
            </span>
          )}
          {isSortLoading && (
            <span className={styles.note}>전체 시세를 불러오는 중입니다</span>
          )}
        </div>

        <StockTable
          stocks={sortedStocks.slice(0, visibleCount)}
          sort={sort}
          onSort={handleSort}
          isSortDisabled={isSortLoading}
          isQuoteLoading={!isQuotesReady}
          favoriteCodes={favoriteCodes}
          onHeartClick={handleHeartClick}
        />

        <div ref={sentinelRef} className={styles.sentinel}>
          {visibleCount < stocks.length && '불러오는 중…'}
        </div>
      </section>

      <Modal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      >
        <p className={styles.modalMessage}>로그인 후 이용 가능한 기능입니다</p>
        <div className={styles.modalButtons}>
          <Link to="/login" className={styles.modalPrimary}>
            로그인
          </Link>
          <button
            type="button"
            className={styles.modalSecondary}
            onClick={() => setIsLoginModalOpen(false)}
          >
            닫기
          </button>
        </div>
      </Modal>
    </>
  )
}
