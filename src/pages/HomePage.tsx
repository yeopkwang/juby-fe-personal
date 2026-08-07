import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { isLoggedIn } from '../utils/auth'
import { toKoreanDate } from '../utils/date'
import { nextSort, sortStocks } from '../utils/sort'
import type { SortKey, SortState, Stock, TopStock } from '../types/stock'
import styles from './HomePage.module.css'

const PAGE_SIZE = 20

export default function HomePage() {
  /*
   * 지난 방문에서 받아둔 카드가 있으면 그걸로 시작한다. 없으면 자리만 잡아 둔다.
   * 어느 쪽이든 아래 effect가 최신 값을 받아 같은 자리에 갈아끼운다.
   */
  const [topStocks, setTopStocks] = useState<(TopStock | null)[]>(
    () => readCachedTopStocks() ?? TOP_THEMES.map(() => null),
  )
  const [hasTopError, setHasTopError] = useState(false)
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

  useEffect(() => {
    // 개발 모드는 effect를 두 번 실행한다. 그대로 두면 일봉 요청이 6건이 되어 서로 제한에 걸린다
    if (hasStartedTop.current) return
    hasStartedTop.current = true

    loadTopStocks((index, stock) => {
      setTopStocks((previous) =>
        previous.map((item, i) => (i === index ? stock : item)),
      )
    }).catch((error: unknown) => {
      console.warn('테마별 대표 종목 조회 실패', error)
      setHasTopError(true)
    })
  }, [])

  useEffect(() => {
    getHomeStocks().then(setStocks)
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
      await loadQuotes(stocks.slice(0, PAGE_SIZE))
      await loadQuotes(stocks)
      setIsQuotesReady(true)
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
        <h2 className={styles.heading}>테마별 대표 종목</h2>

        {/* 한 장도 못 받았을 때만 에러로 대체한다. 일부라도 왔으면 그건 보여주는 편이 낫다 */}
        {hasTopError && topStocks.every((stock) => stock === null) ? (
          <p className={styles.loading}>차트를 불러오지 못했습니다.</p>
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
