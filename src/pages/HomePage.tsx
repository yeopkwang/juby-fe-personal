import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import SearchBar from '../components/SearchBar'
import TopStockCard from '../components/TopStockCard'
import StockTable from '../components/StockTable'
import SectionBoundary from '../components/SectionBoundary'
import Modal from '../components/Modal'
import { TOP_THEMES, loadTopStocks, readCachedTopStocks } from '../api/home'
import { likeStock, unlikeStock } from '../api/member'
import { byTradingValue, getStockList } from '../api/stock'
import { STOCK_LIST } from '../api/stockList'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { isLoggedIn } from '../utils/auth'
import { toKoreanDate } from '../utils/date'
import { nextSort, sortStocks } from '../utils/sort'
import type { SortKey, SortState, Stock, TopStock } from '../types/stock'
import styles from './HomePage.module.css'

const PAGE_SIZE = 20

/** 목록이 아직 없을 때 쓰는 빈 배열. 렌더마다 새로 만들면 useMemo가 매번 다시 돈다 */
const EMPTY_STOCKS: Stock[] = []

type ListState =
  | { kind: 'loading' }
  | { kind: 'ready'; baseDate: string; stocks: Stock[] }
  | { kind: 'error' }

/**
 * 홈. 표는 `GET /api/stocks` 한 번으로 100종목이 다 온다(DB, 증권사 호출 없음).
 *
 * 예전에는 종목마다 현재가를 따로 불러 보이는 20개 먼저·나머지 나중·장 열림 탐지·
 * 지난 값 저장 같은 장치가 이 파일에 가득했다. 지금은 전부 없다.
 */
export default function HomePage() {
  useDocumentTitle('초보자를 위한 주식 비서')
  /*
   * 지난 방문에서 받아둔 카드가 있으면 그걸로 시작한다. 없으면 자리만 잡아 둔다.
   * 어느 쪽이든 아래 effect가 최신 값을 받아 같은 자리에 갈아끼운다.
   */
  const [topStocks, setTopStocks] = useState<(TopStock | null)[]>(
    () => readCachedTopStocks() ?? TOP_THEMES.map(() => null),
  )
  const [hasTopError, setHasTopError] = useState(false)
  const [list, setList] = useState<ListState>({ kind: 'loading' })
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [sort, setSort] = useState<SortState | null>(null)
  /** 관심종목. 처음엔 서버가 준 isLiked로 채우고, 하트를 누르면 서버에 반영한다 */
  const [favoriteCodes, setFavoriteCodes] = useState<Set<string>>(new Set())
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const hasStartedTop = useRef(false)
  /** 하트 요청이 진행 중인 종목. 연타로 등록·해제가 겹쳐 서버와 어긋나는 걸 막는다 */
  const pendingLikes = useRef(new Set<string>())

  useEffect(() => {
    // 개발 모드는 effect를 두 번 실행한다. 그대로 두면 카드 요청이 6건이 되어 제한에 걸린다
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

  const load = useCallback(() => {
    setList({ kind: 'loading' })

    getStockList()
      .then(({ baseDate, stocks }) => {
        setList({ kind: 'ready', baseDate, stocks })
        setFavoriteCodes(
          new Set(
            stocks.filter((stock) => stock.isLiked).map((s) => s.stockCode),
          ),
        )
      })
      .catch((error: unknown) => {
        console.warn('종목 목록 조회 실패', error)
        setList({ kind: 'error' })
      })
  }, [])

  useEffect(load, [load])

  const stocks = list.kind === 'ready' ? list.stocks : EMPTY_STOCKS
  /* 검색 후보는 거래대금 순. 서버 목록은 가나다순이라 그대로 주면 삼성전자가 삼성전기 뒤로 밀린다 */
  const searchable = useMemo(
    () => (stocks.length > 0 ? byTradingValue(stocks) : STOCK_LIST),
    [stocks],
  )

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

  function handleSort(key: SortKey) {
    setSort((current) => nextSort(current, key))
    setVisibleCount(PAGE_SIZE)
  }

  /**
   * 하트는 먼저 바꾸고 서버에 알린다. 서버 응답을 기다렸다 바꾸면 눌린 느낌이 늦다.
   * 실패하면 되돌린다 — 화면만 켜진 채 서버엔 없는 상태로 두면 다음 방문에 사라져 보인다.
   */
  async function handleHeartClick(stockCode: string) {
    if (!isLoggedIn()) {
      setIsLoginModalOpen(true)
      return
    }
    if (pendingLikes.current.has(stockCode)) return

    const wasLiked = favoriteCodes.has(stockCode)
    const apply = (liked: boolean) =>
      setFavoriteCodes((previous) => {
        // Set을 직접 고치면 React가 같은 객체로 보고 다시 그리지 않는다. 복사본을 만든다
        const next = new Set(previous)
        if (liked) next.add(stockCode)
        else next.delete(stockCode)
        return next
      })

    pendingLikes.current.add(stockCode)
    apply(!wasLiked)

    try {
      if (wasLiked) await unlikeStock(stockCode)
      else await likeStock(stockCode)
    } catch (error: unknown) {
      console.warn('관심종목 반영 실패', error)
      apply(wasLiked)
    } finally {
      pendingLikes.current.delete(stockCode)
    }
  }

  const sortedStocks = sort === null ? stocks : sortStocks(stocks, sort)

  return (
    <>
      {/* 목록이 오기 전에는 로컬 사본으로 검색한다. 도착하면 서버 목록으로 바꾼다 */}
      <SearchBar stocks={searchable} />

      <section className={styles.section}>
        <p className={styles.eyebrow}>백테스트 기법으로 투자한 (??? 멘트 수정예정 - 광엽)</p>
        {/* 홈의 대표 제목. 아래 '현재 주가 보기'가 h2로 이어진다 */}
        <h1 className={styles.heading}>테마별 대표 종목</h1>

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
          {/*
            16시 배치 전에는 전 거래일 종가가 뜬다. 언제 것인지 밝혀둔다.
            기준일이 비어 오면 줄째 숨긴다 — 시세표는 그대로 보여준다
          */}
          {list.kind === 'ready' && toKoreanDate(list.baseDate) !== '' && (
            <span className={styles.asOf}>
              {toKoreanDate(list.baseDate)} 종가 기준
            </span>
          )}
        </div>

        {list.kind === 'loading' && (
          <p className={styles.loading}>시세를 불러오는 중…</p>
        )}

        {list.kind === 'error' && (
          <div className={styles.loading}>
            <p>시세를 불러오지 못했습니다.</p>
            <button type="button" className={styles.retry} onClick={load}>
              다시 시도
            </button>
          </div>
        )}

        {/* 표를 그리다 멈춰도 검색·테마 카드는 남는다. 다시 시도하면 목록을 새로 받는다 */}
        {list.kind === 'ready' && (
          <SectionBoundary onRetry={load}>
            <StockTable
              stocks={sortedStocks.slice(0, visibleCount)}
              sort={sort}
              onSort={handleSort}
              favoriteCodes={favoriteCodes}
              onHeartClick={(code) => void handleHeartClick(code)}
            />

            <div ref={sentinelRef} className={styles.sentinel}>
              {visibleCount < stocks.length && '불러오는 중…'}
            </div>
          </SectionBoundary>
        )}
      </section>

      <Modal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        label="로그인 안내"
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
