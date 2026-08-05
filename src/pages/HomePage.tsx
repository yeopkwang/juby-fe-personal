import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import SearchBar from '../components/SearchBar'
import TopStockCard from '../components/TopStockCard'
import StockTable from '../components/StockTable'
import Modal from '../components/Modal'
import { getHomeStocks, getQuotes, getTopStocks } from '../api/home'
import { isLoggedIn } from '../utils/auth'
import { nextSort, sortStocks } from '../utils/sort'
import type { SortKey, SortState, Stock, TopStock } from '../types/stock'
import styles from './HomePage.module.css'

const PAGE_SIZE = 20

export default function HomePage() {
  const [topStocks, setTopStocks] = useState<TopStock[]>([])
  const [isTopLoading, setIsTopLoading] = useState(true)
  const [hasTopError, setHasTopError] = useState(false)
  const [stocks, setStocks] = useState<Stock[]>([])
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [sort, setSort] = useState<SortState | null>(null)
  const [isSortLoading, setIsSortLoading] = useState(false)
  /** 관심종목. 등록 API가 없어 아직 화면 안에서만 유지된다 */
  const [favoriteCodes, setFavoriteCodes] = useState<Set<string>>(new Set())
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

  /** 이미 시세를 요청한 종목코드. 실패한 종목을 무한히 다시 부르는 걸 막는다 */
  const requestedCodes = useRef(new Set<string>())
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getTopStocks()
      .then(setTopStocks)
      .catch((error: unknown) => {
        console.warn('테마별 대표 종목 조회 실패', error)
        setHasTopError(true)
      })
      .finally(() => setIsTopLoading(false))
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
    const quotes = await getQuotes(fresh)

    setStocks((previous) =>
      previous.map((stock) => {
        const quote = quotes.get(stock.stockCode)
        return quote === undefined ? stock : { ...stock, ...quote }
      }),
    )
  }, [])

  // 화면에 드러난 종목만 시세를 채운다
  useEffect(() => {
    loadQuotes(stocks.slice(0, visibleCount))
  }, [stocks, visibleCount, loadQuotes])

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
    // 시세 기준 정렬은 102종목 값이 다 있어야 맞다. 아직 안 부른 종목을 여기서 마저 부른다
    if (key !== 'stockName' && requestedCodes.current.size < stocks.length) {
      setIsSortLoading(true)
      await loadQuotes(stocks)
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
        <p className={styles.eyebrow}>백테스트 기업으로 투자한</p>
        <h2 className={styles.heading}>테마별 대표 종목</h2>

        {isTopLoading && <p className={styles.loading}>불러오는 중…</p>}

        {hasTopError && (
          <p className={styles.loading}>차트를 불러오지 못했습니다.</p>
        )}

        {!isTopLoading && !hasTopError && (
          <div className={styles.cards}>
            {topStocks.map((stock) => (
              <TopStockCard key={stock.stockCode} stock={stock} />
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.headingRow}>
          <h2 className={styles.heading}>현재 주가 보기</h2>
          {isSortLoading && (
            <span className={styles.note}>전체 시세를 불러오는 중…</span>
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
            로그인하러 가기
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
