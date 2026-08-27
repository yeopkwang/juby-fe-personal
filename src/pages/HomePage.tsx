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
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { delay } from '../utils/async'
import { isLoggedIn } from '../utils/auth'
import { toKoreanDate } from '../utils/date'
import {
  ApiError,
  BlockedPathError,
  NoResponseError,
  UserFacingError,
  isRetryable,
} from '../utils/error'
import { nextSort, sortStocks } from '../utils/sort'
import { loadStockChartPage } from './lazy'
import type { SortKey, SortState, Stock, TopStock } from '../types/stock'
import styles from './HomePage.module.css'

const PAGE_SIZE = 20

/**
 * 왜 못 받았는지 한 문장.
 *
 * utils/error.ts의 `toUserMessage`를 쓰지 않는다. 그쪽은 **화면 전체가 죽었을 때** 쓰라고
 * 만든 문구라 '아직 준비되지 않은 기능입니다'처럼 판정을 내린다. 홈은 다르다 —
 * 카드도 표도 멀쩡히 떠 있고 비어 있는 것은 값뿐이라, 그 자리에서 그 문장을 읽으면
 * "준비 안 됐다는데 카드는 있네?"가 된다.
 *
 * 그래서 판정 대신 **원인**을 적는다. 사용자가 다음에 무엇을 할지 정하려면 그게
 * 필요하기 때문이다 — 잠시 뒤 다시 오면 되는 일인지, 원래 안 되는 일인지.
 *
 * 종류를 가르는 기준은 error.ts와 같다. 문구를 뜯어보는 방식(`message.includes`)은
 * 문구를 고치는 순간 조용히 어긋나므로 쓰지 않는다.
 */
function toReason(error: unknown): string {
  /* 서버가 준 한국어 완성문이다. 덮으면 오히려 아는 것이 줄어든다 */
  if (error instanceof UserFacingError) return error.message

  /*
   * 이 앱이 스스로 막은 경로다(client.ts의 허용 목록). 홈이 102종목을 몰아쳐 증권사
   * 계정 경고를 받은 것이 그 이유라, 사용자에게도 그대로 말해도 되는 사정이다.
   */
  if (error instanceof BlockedPathError) {
    return '시세를 한꺼번에 많이 불러오는 길이 막혀 있어요.'
  }

  if (error instanceof NoResponseError) return '서버가 응답하지 않았어요.'

  if (error instanceof ApiError) {
    if (error.status >= 500) return '서버에 문제가 생겼어요.'
    if (error.status === 404) return '자료를 찾지 못했어요.'
    return `요청이 처리되지 않았어요. (오류 ${error.status})`
  }

  /* 넷에 안 걸리면 코드 버그일 가능성이 크다. 지어낸 설명보다 모른다고 하는 편이 낫다 */
  return '원인을 알 수 없어요.'
}

/**
 * 시세 루프가 카드를 기다려 주는 최대 시간. 카드 세 건이 정상이면 0.5초 안에 끝나고,
 * 그보다 오래 걸리면 백엔드가 아픈 것이라 표까지 붙잡혀 있을 이유가 없다.
 */
const CARD_HEAD_START = 1200

export default function HomePage() {
  useDocumentTitle(null)

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
  /** 시세를 한 건도 못 받았을 때 그 원인. 받았으면 null */
  const [quoteFailure, setQuoteFailure] = useState<unknown>(null)
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
   * 홈을 떠났는지 알린다. 상세로 넘어가도 시세 루프가 계속 돌면서 호출 제한을 채워
   * 차트 요청이 뒤로 밀려 500을 맞는다. 떠나는 순간 남은 묶음을 버린다.
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
   * 실패의 종류를 그대로 들고 와야(isRetryable) 버튼을 내밀지 정할 수 있다.
   * 지금 이 경로는 허용 목록에 없어서 몇 번을 눌러도 결과가 같다.
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
        /*
         * 여기는 원인을 적지 않는다. 카드 세 장 바로 위 한 줄이라, 이 자리에서
         * 필요한 것은 **무엇이 비었는지**까지다. 왜 그런지와 어디로 가면 되는지는
         * 아래 표 위에 한 번 적혀 있고, 같은 화면에서 두 번 말하면 길이만 늘고
         * 읽히지는 않는다.
         */
        setTopErrorMessage('등락률과 그래프를 받지 못했어요.')
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

  /*
   * 종목 상세 묶음을 한가할 때 미리 받아 둔다.
   *
   * 실측(배포본, 1.5Mbps / 지연 150ms): 종목을 누르고 화면이 뜰 때까지 831ms였다.
   * 그중 대부분이 그때서야 StockChartPage 묶음(전송 56KB, lightweight-charts)을
   * 받으러 가는 시간이다. 누른 뒤에 받으면 그 시간이 통째로 사용자 앞에 드러난다.
   *
   * 홈에서 나가는 길은 표 102줄·카드 3장·검색 결과인데 **전부 상세로 간다.**
   * 헛수고가 될 확률이 낮아서 미리 받을 만하다.
   *
   * ⚠️ 예전에 걷어낸 'hover 미리받기'와 다른 이야기다. 그건 KIS 시세 요청이라
   * 미리 부르는 만큼 호출 제한을 먹었다. 이건 정적 파일이라 서버에 부담이 없고
   * 브라우저가 캐시한다. 화면을 여는 시점에는 이미 와 있다.
   *
   * 헤더 메뉴처럼 짚을 때가 아니라 한가할 때 받는 건, 여기서 나가는 길이 표 102줄과
   * 카드와 검색 결과로 흩어져 있어서다. 하나하나에 거는 대신 한 번만 받아 둔다.
   */
  useEffect(() => {
    const prefetch = () => {
      void loadStockChartPage().catch(() => {})
    }

    /* Safari 16.3 이하에는 requestIdleCallback이 없다. 그쪽은 타이머로 대신한다 */
    if (typeof requestIdleCallback !== 'function') {
      const timer = setTimeout(prefetch, 1500)
      return () => clearTimeout(timer)
    }

    /* timeout을 주는 건 계속 바쁜 화면에서 영영 안 불리는 것을 막기 위해서다 */
    const handle = requestIdleCallback(prefetch, { timeout: 3000 })
    return () => cancelIdleCallback(handle)
  }, [])

  const loadQuotes = useCallback(async (targets: Stock[]) => {
    const fresh = targets.filter(
      (stock) => !requestedCodes.current.has(stock.stockCode),
    )
    if (fresh.length === 0) return

    fresh.forEach((stock) => requestedCodes.current.add(stock.stockCode))
    const { quotes, frozenDate: frozen, failure } = await getQuotes(
      fresh,
      () => hasLeft.current,
    )

    setFrozenDate(frozen)
    /*
     * 한 건도 못 받았을 때만 원인이 실려 온다. 표 위에 왜 비었는지 적는 데 쓴다.
     * 이 함수는 한 화면에서 두 번 돈다(보이는 20개 → 나머지). 뒤엣것이 성공하면
     * null로 덮여 안내가 사라지는데, 값이 실제로 채워지므로 그게 맞다.
     */
    setQuoteFailure(failure)
    setStocks((previous) =>
      previous.map((stock) => {
        const quote = quotes.get(stock.stockCode)
        return quote === undefined ? stock : { ...stock, ...quote }
      }),
    )
  }, [])

  /*
   * 보이는 20개를 먼저 채워 표를 띄우고 나머지는 뒤에서 받는다. 예전에는 정렬을 누른
   * 뒤에야 나머지를 불러서 3초 넘게 멈춰 있었다.
   * stocks가 시세를 채울 때마다 새 배열이 되므로 ref로 한 번만 시작하게 막는다.
   */
  useEffect(() => {
    if (stocks.length === 0) return
    if (hasStartedQuotes.current) return
    hasStartedQuotes.current = true

    allQuotesRef.current = (async () => {
      /*
       * 카드가 먼저 나오도록 길을 비켜주되 기다리는 시간에 상한을 둔다.
       *
       * 둘 다 초당 호출 제한을 함께 써서, 동시에 출발하면 102종목 쪽이 창구를 채워
       * 세 건이면 끝날 카드가 500을 맞고 재시도하느라 몇 초씩 늦어졌다.
       * 그렇다고 무작정 기다리면 백엔드가 멈췄을 때 표가 시세를 한 번도 요청하지
       * 못해 대체 값까지 못 쓰고 전부 '-'로 남는다.
       */
      await Promise.race([topStocksRef.current, delay(CARD_HEAD_START)])

      /*
       * finally인 건 두 가지가 이 한 줄에 매달려서다 — 빈 칸이 회색 판에서 "-"로
       * 넘어가는 시점, 정렬 버튼이 기다리는 대상. 예외가 새면 표는 영원히 오는
       * 중이고 정렬은 영원히 잠긴다.
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

  /*
   * 시세를 한 건도 못 받았는가. **오는 중과 구분해야 한다** — 오는 중이면 표에
   * 회색 판이 돌고 있어서 아무 말도 필요 없다. 다 끝났는데도 전부 비었을 때만이다.
   */
  const hasNoQuotes =
    isQuotesReady &&
    stocks.length > 0 &&
    stocks.every((stock) => stock.currentPrice === null)

  return (
    <>
      <SearchBar />

      <section className={styles.section}>
        <p className={styles.eyebrow}>백테스트 기법으로 투자한</p>
        {/* 홈의 대표 제목. 아래 '현재 주가 보기'가 h2로 이어진다 */}
        <h1 className={styles.heading}>테마별 대표 종목</h1>

        {/*
          못 받았어도 **카드는 지우지 않는다.** 예전에는 한 장도 못 받으면 카드 세 장을
          통째로 걷어내고 에러 한 줄만 남겼는데, 두 가지가 잘못이었다.

          ① 지운 것 중에 맞는 정보가 있었다. 카드가 들고 있는 테마('기술주 대장')와
             종목명은 프론트에 박혀 있는 값이라 시세와 무관하게 언제나 맞다.
             못 받는 건 그래프와 등락률뿐인데 멀쩡한 것까지 같이 지웠다.
          ② 아래 표는 같은 실패를 다르게 다룬다. 표는 행을 남기고 값 자리에 "-"를
             넣는다. 한 화면에서 같은 실패가 두 모습이면 사용자는 규칙을 못 읽는다.
          ③ 실측: 카드가 떴다가(390px) 200ms 만에 에러 한 줄로(131px) 접히면서
             레이아웃 밀림 0.086이 났다. 남겨 두면 그것도 같이 사라진다.

          그래서 LoadFailure는 자리를 '대신 채우는' 것이 아니라 카드 위에서 왜 값이
          비었는지 **설명하는** 역할로 쓴다. 다시 눌러 볼 만한 실패면 버튼도 그대로다.
        */}
        {topErrorMessage !== null && (
          <LoadFailure
            message={topErrorMessage}
            onRetry={canRetryTop ? handleTopRetry : undefined}
            isRetrying={isRetryingTop}
          />
        )}

        <div className={styles.cards}>
          {TOP_THEMES.map((theme, index) => (
            <TopStockCard
              key={theme.stockCode}
              theme={theme}
              stock={topStocks[index]}
            />
          ))}
        </div>
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

        {/*
          표 전체가 "-"인 채로 아무 말이 없으면 사용자는 자기 인터넷이나 앱을 의심한다.
          그리고 여기서 못 보여주는 값을 **종목 상세에서는 보여준다**(창구가 다르다).
          "없다"만 말하고 끝내지 않고 갈 곳을 함께 적는 이유다.
        */}
        {hasNoQuotes && (
          <p className={styles.quoteNote}>
            목록에 시세를 채우지 못했어요. {toReason(quoteFailure)} 종목명을 누르면
            그 종목의 시세와 차트를 볼 수 있어요.
          </p>
        )}

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
