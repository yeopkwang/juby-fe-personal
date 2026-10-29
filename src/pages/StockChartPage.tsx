import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import CandleChart from '../components/CandleChart'
import Modal from '../components/Modal'
import NewsList from '../components/NewsList'
import SectionBoundary from '../components/SectionBoundary'
import { ApiError } from '../api/client'
import { getLikeStocksOnPublicPage, likeStock, unlikeStock } from '../api/member'
import {
  detailWaitMs,
  getStockDetail,
  isStockCode,
  isStockDetailInFlight,
  peekStockDetail,
  primeKisToken,
} from '../api/stock'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useIsLoggedIn } from '../hooks/useIsLoggedIn'
import { toStockHandoff } from '../hooks/useStockHandoff'
import { periodStart, toKoreanDate, toKoreanDateTime } from '../utils/date'
import {
  formatChangeRate,
  formatPrice,
  formatVolume,
  isFiniteNumber,
  isFlatRate,
} from '../utils/format'
import { loginPathFrom } from '../utils/navigation'
import { readPreview } from '../utils/stockPreview'
import type { Candle, Period, StockDetail, StockInfo, StockPreview } from '../types/stock'
import styles from './StockChartPage.module.css'

/** 백엔드 Period enum 순서 그대로. 화면 탭도 이 순서로 놓는다 */
const PERIOD_TABS: { period: Period; label: string }[] = [
  { period: 'ONE_WEEK', label: '1주' },
  { period: 'ONE_MONTH', label: '1개월' },
  { period: 'THREE_MONTH', label: '3개월' },
  { period: 'SIX_MONTH', label: '6개월' },
  { period: 'ONE_YEAR', label: '1년' },
  { period: 'THREE_YEAR', label: '3년' },
  { period: 'ALL', label: '전체' },
]

/** 서버 오류 뒤 첫 재시도까지. 잠깐의 오류는 대개 이걸로 풀린다(아래 effect의 schedule) */
const QUICK_RETRY_MS = 1_500

/** 처음 열었을 때 기간. 60봉쯤이 봉 모양과 흐름이 함께 읽히는 길이다 */
const DEFAULT_PERIOD: Period = 'THREE_MONTH'

/**
 * 받아 온 결과는 어느 종목의 것인지(stockCode)를 함께 든다. 같은 라우트 안에서 주소가 A→B로 바뀌면
 * effect가 돌기 전 첫 렌더에 A의 결과가 남아 있어, B 코드 옆에 A의 이름·현재가·차트와 탭 제목이 그려졌다.
 * 렌더에서 코드를 견줘 다르면 불러오는 중으로 본다(아래 view).
 */
type State =
  | { kind: 'loading' }
  /** 실패해서 다시 부르기 전에 간격(api/stock.ts DETAIL_GAP_MS)을 기다리는 중. until(ms)이 되면 보낸다 */
  | { kind: 'waiting'; stockCode: string; until: number }
  | { kind: 'ready'; stockCode: string; detail: StockDetail }
  /** 백엔드 stock 테이블에 없는 종목코드 */
  | { kind: 'notFound'; stockCode: string }
  | { kind: 'error'; stockCode: string }

/**
 * 이 종목이 내 관심종목인가. 상세 응답에는 관심 여부가 없어, 로그인했으면 관심종목 목록(DB)을 한 번 받아 가린다.
 * 어느 종목의 것인지 함께 든다 — 위 State와 같은 이유로, 종목을 갈아타면 앞 종목의 하트가 한 번 비친다.
 */
type LikeState =
  | { kind: 'loading' }
  /** 목록을 못 받았다. 켜져 있는지 모르니 누를 수 없게 두고 다시 시도를 준다 */
  | { kind: 'error'; stockCode: string }
  | { kind: 'ready'; stockCode: string; liked: boolean }

/** 화면이 보는 하트 상태. 비로그인은 목록을 부르지 않고, 누르면 로그인 안내를 띄운다 */
type LikeView = LikeState | { kind: 'loggedOut' }

/**
 * 기간 탭은 서버에 기간마다 다시 묻지 않고 받아 둔 전체 일봉을 여기서 자른다. 상세 API는 일봉은 DB에서 주지만
 * 현재가 하나를 증권사에 물어본다. 탭을 누를 때마다 그 호출이 나가는 건 낭비라 ALL로 한 번 받는다.
 * 시작일은 서버에 period를 보낸 것과 같은 규칙으로 낸다(periodStart).
 */
function sliceByPeriod(candles: Candle[], period: Period): Candle[] {
  const last = candles.at(-1)
  if (last === undefined) return candles

  const start = periodStart(last.date, period)
  // 날짜가 YYYYMMDD 문자열이라 사전순 비교가 곧 날짜순 비교다
  return start === null ? candles : candles.filter((c) => c.date >= start)
}

/**
 * 화면에 적을 종목 이름. 서버가 이름을 비워 보내면(빈 문자열·공백) 종목코드로 대신한다 —
 * 탭 제목이 "JUBY"만 남고 제목 줄의 이름 자리가 비었다. 응답 모양상 null도 올 수 있어 문자열인지부터 본다
 */
function nameOrCode(name: string | null | undefined, stockCode: string | undefined): string {
  return typeof name === 'string' && name.trim() !== '' ? name : (stockCode ?? '')
}

function toRateClassName(rate: number | null): string | undefined {
  // 비어 온 등락률("-")은 보합처럼 검정으로 둔다
  if (!isFiniteNumber(rate) || isFlatRate(rate)) return styles.flat
  return rate > 0 ? styles.up : styles.down
}

/** 시세 요약 네 칸. 값이 오기 전에도 같은 칸을 그려 자리를 잡아 둔다 */
const SUMMARY_LABELS = ['시가', '고가', '저가', '거래량']

export default function StockChartPage() {
  const { stockCode } = useParams<{ stockCode: string }>()
  /*
   * 목록에서 누르고 왔으면 이름(과 기준일 종가)을 들고 온다. 응답을 기다리는 동안 그 자리를
   * 먼저 채운다. 주소를 직접 열었으면 없다 — 그땐 뼈대를 그린다.
   */
  const location = useLocation()
  const preview =
    stockCode === undefined ? null : readPreview(location.state, stockCode)

  const [state, setState] = useState<State>({ kind: 'loading' })
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD)
  /** '다시 시도'가 1씩 올린다. 같은 종목으로 아래 effect를 한 번 더 돌리는 유일한 방법 */
  const [retryCount, setRetryCount] = useState(0)
  /*
   * 다시 시도가 남기는 표시. 아래 effect가 한 번 쓰고 지운다 — 그 한 번만 방금 받아 둔 값을 쓰지 않고 새로 받는다.
   * retryCount > 0으로 가르면 한 번 누른 뒤로는 화면이 살아 있는 동안 계속 참이라, 다른 종목에 갔다 와도 1분 캐시를 안 썼다
   */
  const freshNextRef = useRef(false)

  /*
   * 종목을 빠르게 갈아타면 먼저 보낸 요청이 나중에 도착해 새 종목 화면을 덮을 수 있다.
   * 그래서 응답을 받는 자리마다 isStale을 본다. 정리 함수는 이미 나간 요청을 취소하지
   * 못하고 '이 응답은 이제 쓸모없다'는 표시만 남긴다(NewsList도 같은 방식이다).
   *
   * 예전에는 요청을 거는 쪽을 isStale로 감쌌는데, 그 자리는 effect 안에서 곧바로
   * 실행돼 검사할 시점에 늘 false였다. 막는 시늉만 하고 아무것도 막지 못했다.
   */
  /*
   * 형식이 틀린 코드면 요청하지 않고 곧바로 "없는 종목"이다. effect에서 막으면 늦는다 —
   * 첫 렌더에 뉴스 목록이 먼저 마운트되고, 자식의 effect가 부모보다 먼저 돌아 요청이 나간다.
   * 그래서 렌더에서 판단해 뉴스 목록을 아예 그리지 않는다(아래 notFound 분기).
   */
  const hasValidCode = stockCode !== undefined && isStockCode(stockCode)

  useEffect(() => {
    if (stockCode === undefined || !hasValidCode) return
    let isStale = false
    let timer: ReturnType<typeof setTimeout> | undefined

    // 다시 시도로 도는 이번 한 번만 방금 받아 둔 값을 쓰지 않고 새로 받는다
    const fresh = freshNextRef.current
    freshNextRef.current = false

    // 방금 본 종목이면 서버에 묻지 않는다
    const remembered = fresh ? null : peekStockDetail(stockCode)
    if (remembered !== null) {
      setState({ kind: 'ready', stockCode, detail: remembered })
      return
    }

    // 안쪽 함수에서는 위의 undefined 검사가 이어지지 않아 좁혀진 값을 따로 둔다
    const code = stockCode

    /*
     * 실패하면 저절로 두 번까지 다시 부른다. 늦출수록 딜레이라 짧은 것부터 한다.
     * - 0번째: 곧바로. 서버가 멀쩡하면(평일, 또는 로그인해 토큰을 심었으면) 종목을 연달아 열어도 기다리지 않는다.
     * - 1번째: 1.5초 뒤. 잠깐의 서버 오류는 대개 이걸로 풀린다. 서버 오류가 나면 심어 둔 표시가 지워지므로
     *   로그인했으면 이때 토큰을 다시 심는다(api/stock.ts forgetKisTokenPrime).
     * - 2번째: 마지막으로 보낸 때에서 65초 뒤(api/stock.ts "실패한 뒤 다시 부를 간격"). 1분에 1건만 되는 날(주말,
     *   비로그인)은 그 안에 다시 불러도 또 실패한다. 남은 초를 센다.
     * 그래도 실패하면 "다시 시도"를 띄우고, 그 버튼은 2번째와 같이 간격을 지켜 보낸다.
     * 기다리는 사이 다른 종목으로 가면 정리 함수가 타이머를 지워 이 종목 요청은 더 나가지 않는다.
     */
    function schedule(attempt: number) {
      const wait =
        attempt === 0 || isStockDetailInFlight(code)
          ? 0
          : attempt === 1
            ? QUICK_RETRY_MS
            : detailWaitMs()
      if (wait === 0) {
        send(attempt)
        return
      }
      // 짧은 기다림은 뼈대로 두고, 긴 기다림만 남은 초를 센다
      setState(
        attempt >= 2
          ? { kind: 'waiting', stockCode: code, until: Date.now() + wait }
          : { kind: 'loading' },
      )
      // 긴 기다림은 끝날 때 다시 잰다 — 그사이 다른 탭이 보냈으면 더 기다린다
      timer = setTimeout(() => (attempt >= 2 ? schedule(attempt) : send(attempt)), wait)
    }

    function send(attempt: number) {
      setState({ kind: 'loading' })
      // 로그인했으면 먼저 증권사 토큰을 심는다(api/stock.ts "증권사 토큰 심기"). 심는 사이 떠났으면 상세는 보내지 않는다
      primeKisToken(code)
        .then(() => (isStale ? null : getStockDetail(code, 'ALL', { fresh: true })))
        .then((detail) => {
          if (isStale || detail === null) return
          setState({ kind: 'ready', stockCode: code, detail })
        })
        .catch((error: unknown) => {
          if (isStale) return
          if (error instanceof ApiError && error.status === 404) {
            setState({ kind: 'notFound', stockCode: code })
            return
          }
          console.warn('종목 상세 조회 실패', error)
          // 4xx와 모양이 틀린 200은 다시 불러도 같다. 서버 오류(5xx)와 서버에 못 닿은 경우만 다시 부른다
          const serverSide = !(error instanceof ApiError) || error.status >= 500
          if (attempt < 2 && serverSide) {
            schedule(attempt + 1)
            return
          }
          setState({ kind: 'error', stockCode: code })
        })
    }

    // 다시 시도 버튼으로 왔으면(fresh) 방금 실패한 것이니 간격부터 지킨다
    schedule(fresh ? 2 : 0)

    return () => {
      isStale = true
      clearTimeout(timer)
    }
  }, [stockCode, hasValidCode, retryCount])

  const loggedIn = useIsLoggedIn()
  const [like, setLike] = useState<LikeState>({ kind: 'loading' })
  /** 관심종목 목록의 '다시 시도'가 올린다 */
  const [likeRetryCount, setLikeRetryCount] = useState(0)
  /** 하트 요청이 진행 중인 종목. 연타로 등록·해제가 겹쳐 서버와 어긋나는 걸 막는다(홈과 같다) */
  const pendingLikes = useRef(new Set<string>())
  /** 하트를 서버에 반영하지 못해 되돌렸을 때 알리는 말. 어느 종목의 것인지 함께 든다 */
  const [likeNotice, setLikeNotice] = useState<{ stockCode: string; text: string } | null>(null)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

  /*
   * 하트의 처음 상태. 로그인했을 때만 관심종목 목록(DB, 증권사 무관)을 받고, 로그인·로그아웃(다른 탭 포함)을 따라간다.
   * 이 화면에 새로 생긴 요청은 이것 하나다 — 토큰 심기·상세·뉴스는 그대로 나간다.
   * 공개 화면이 들어오자마자 부르는 요청이라 401이면 로그인 화면으로 끌고 가지 않는다(getLikeStocksOnPublicPage).
   */
  useEffect(() => {
    if (stockCode === undefined || !hasValidCode || !loggedIn) return
    let isStale = false
    const code = stockCode
    setLike({ kind: 'loading' })

    getLikeStocksOnPublicPage()
      .then((list) => {
        // null이면 토큰이 만료돼 지웠다. 로그인 구독이 이 화면을 비로그인으로 바꾼다
        if (isStale || list === null) return
        setLike({
          kind: 'ready',
          stockCode: code,
          liked: list.likeStockList.some((item) => item.stockCode === code),
        })
      })
      .catch((error: unknown) => {
        if (isStale) return
        console.warn('관심종목 목록 조회 실패', error)
        setLike({ kind: 'error', stockCode: code })
      })

    return () => {
      isStale = true
    }
  }, [stockCode, hasValidCode, loggedIn, likeRetryCount])

  /*
   * 탭 제목에 종목명을 넣는다. 종목 여러 개를 띄워 두고 비교할 때 탭이 다 'JUBY'면
   * 어느 게 어느 종목인지 알 수 없다. 받아오는 중이면 들고 온 이름을 쓰고,
   * 그것도 없거나 없는 종목·실패일 때는 '종목'으로 둔다.
   */
  // 앞 종목의 결과면 아직 이 종목을 받는 중이다
  const view: State =
    state.kind !== 'loading' && state.stockCode !== stockCode
      ? { kind: 'loading' }
      : state

  useDocumentTitle(
    view.kind === 'ready'
      ? nameOrCode(view.detail.stockName, stockCode)
      : view.kind === 'loading'
        ? (preview?.stockName ?? '종목')
        : '종목',
  )

  // 없는 종목에는 바로 가기 버튼도 두지 않는다
  if (stockCode === undefined || !hasValidCode || view.kind === 'notFound') {
    return (
      <section className={styles.section}>
        <h1 className={styles.heading}>목록에 없는 종목입니다</h1>
        <Link to="/" className={styles.backLink}>
          홈으로 돌아가기
        </Link>
      </section>
    )
  }

  const detail = view.kind === 'ready' ? view.detail : null

  /*
   * 백테스트·AI로 실어 갈 종목명. 응답의 이름, 아직이면 목록에서 실어 온 이름이다. 응답이 이름을 비워 종목코드로
   * 대신했으면(nameOrCode) 모르는 것으로 본다 — AI에 "005930의 주가에 대해서…"로 묻게 된다. 모르면 두 버튼을 잠근다
   */
  const knownName =
    detail !== null && nameOrCode(detail.stockName, stockCode) !== stockCode
      ? detail.stockName
      : (preview?.stockName ?? null)

  // 앞 종목의 상태면 아직 이 종목을 받는 중이다
  const likeView: LikeView = !loggedIn
    ? { kind: 'loggedOut' }
    : like.kind !== 'loading' && like.stockCode === stockCode
      ? like
      : { kind: 'loading' }

  /**
   * 하트는 홈과 같은 규칙이다. 먼저 바꾸고 서버에 알리며, 실패하면 되돌리고 알린다(조용히 되돌리면 누른 게 무시된 것처럼 보인다).
   * 처음 상태를 모르면(받는 중·못 받음) 버튼이 잠겨 여기 오지 않는다.
   */
  async function handleHeartClick() {
    if (!loggedIn) {
      setIsLoginModalOpen(true)
      return
    }
    if (likeView.kind !== 'ready') return
    const { stockCode: code, liked: wasLiked } = likeView
    if (pendingLikes.current.has(code)) return

    // 기다리는 사이 다른 종목으로 갔으면 그 종목의 하트는 건드리지 않는다
    const apply = (liked: boolean) =>
      setLike((previous) =>
        previous.kind === 'ready' && previous.stockCode === code
          ? { ...previous, liked }
          : previous,
      )

    pendingLikes.current.add(code)
    setLikeNotice(null)
    apply(!wasLiked)

    try {
      if (wasLiked) await unlikeStock(code)
      else await likeStock(code)
    } catch (error: unknown) {
      console.warn('관심종목 반영 실패', error)
      apply(wasLiked)
      setLikeNotice({
        stockCode: code,
        text: wasLiked
          ? '관심종목을 해제하지 못했어요. 잠시 후 다시 시도해 주세요.'
          : '관심종목에 추가하지 못했어요. 잠시 후 다시 시도해 주세요.',
      })
    } finally {
      pendingLikes.current.delete(code)
    }
  }

  const stock: StockInfo | null =
    knownName === null ? null : { stockCode, stockName: knownName }
  /** 로그인하면 이 상세로 돌아온다(비로그인 바로 가기·하트 안내) */
  const loginPath = loginPathFrom(`${location.pathname}${location.search}`)

  const likeToggle = <LikeToggle like={likeView} onToggle={() => void handleHeartClick()} />

  const likeStatus =
    likeView.kind === 'error' ? (
      <p className={styles.likeStatus} role="status">
        관심종목을 불러오지 못했습니다.
        <button
          type="button"
          className={styles.retryButton}
          onClick={() => setLikeRetryCount((count) => count + 1)}
        >
          다시 시도
        </button>
      </p>
    ) : likeNotice?.stockCode === stockCode ? (
      <p className={styles.likeStatus} role="status">
        {likeNotice.text}
      </p>
    ) : null

  const actionPanel = (
    <ActionPanel
      title={`${knownName ?? '이 종목'}, 이렇게 살펴보세요`}
      stock={stock}
      loginPath={loggedIn ? null : loginPath}
    />
  )

  /*
   * 다시 시도. 받아 둔 값을 먼저 버리고(불러오는 중) 새로 받는다. 구역 경계는 누르는 순간 안쪽을 다시 그리는데,
   * 그때 멈추게 한 옛 값을 그대로 들고 있으면 곧바로 또 멈춰, 새 값이 멀쩡하게 와도 안내가 풀리지 않았다
   * (2026-09-27 재현). 홈 카드의 다시 시도와 같은 방식이다.
   */
  function retry() {
    setState({ kind: 'loading' })
    freshNextRef.current = true
    setRetryCount((count) => count + 1)
  }

  return (
    <>
      {/*
        가격·차트를 그리다 멈춰도 뉴스는 남는다. 다시 시도하면 종목 정보를 새로 받는다.
        오류 경계는 자식이 그리다 난 오류만 받아내므로 이 구역을 PriceSection으로 떼어 뒀다 —
        여기(StockChartPage) 렌더에서 계산하면 경계를 지나쳐 화면 전체가 오류 화면이 된다.
      */}
      {/* 종목이 바뀌면 앞 종목에서 멈춘 상태를 푼다 */}
      {/*
        넓은 화면(1600px 이상)은 가격 구역 | 뉴스 두 열이다. 가격 구역 안이 다시 정보 열 | 차트로 나뉘어 화면에는 세 열로 보인다
        (2026-10-30 재정비 — 16:9에서 좌우가 비어 보이고 뉴스가 첫 화면에 안 보였다). 그보다 좁으면 뉴스가 아래로 내려간다
      */}
      <div className={styles.layout}>
      <SectionBoundary
        resetKey={stockCode}
        onRetry={retry}
      >
        <PriceSection
          stockCode={stockCode}
          detail={detail}
          preview={preview}
          period={period}
          onPeriodChange={setPeriod}
          waiting={view.kind === 'waiting' ? view : null}
          failed={view.kind === 'error'}
          onRetry={retry}
          likeToggle={likeToggle}
          likeStatus={likeStatus}
          actionPanel={actionPanel}
        />
      </SectionBoundary>

      <section className={styles.newsColumn}>
        <NewsList stockCode={stockCode} />
      </section>
      </div>

      {/* 홈 하트와 같은 안내. 로그인하면 이 상세로 돌아온다 */}
      <Modal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        label="로그인 안내"
      >
        <p className={styles.modalMessage}>로그인 후 이용 가능한 기능입니다</p>
        <div className={styles.modalButtons}>
          <Link to={loginPath} className={styles.modalPrimary}>
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

/** 관심종목 토글. 종목명 줄 오른쪽 끝의 작은 테두리 단추(하트 + "관심종목")다 */
function LikeToggle({ like, onToggle }: { like: LikeView; onToggle: () => void }) {
  const liked = like.kind === 'ready' && like.liked
  return (
    <button
      type="button"
      className={liked ? styles.likeOn : styles.like}
      onClick={onToggle}
      // 받는 중이거나 못 받았으면 켜져 있는지 모른다. 모르는 채로 바꾸지 않는다. 비로그인은 눌러서 로그인 안내를 본다
      disabled={like.kind === 'loading' || like.kind === 'error'}
      aria-pressed={liked}
      aria-label={liked ? '관심종목 해제' : '관심종목 추가'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} aria-hidden="true">
        <path
          d="M12 20.3 4.1 12.4a4.9 4.9 0 0 1 6.9-6.9l1 1 1-1a4.9 4.9 0 0 1 6.9 6.9z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      {/* 보이는 글은 이름("관심종목 추가/해제")에 들어 있다 */}
      관심종목
    </button>
  )
}

/** 바로 가기 두 단추. 백테스트가 주 행동이라 브랜드 초록으로 채우고, AI는 먹 테두리다(2026-10-30 재정비, 시안 B) */
const ACTIONS = [
  {
    to: '/backtest',
    name: '이 종목 백테스트',
    desc: '전략을 과거 주가에 적용해 점수로 보여드려요',
    primary: true,
  },
  {
    to: '/ai',
    name: 'AI에게 물어보기',
    desc: '왜 올랐는지, 나와 맞는지 물어보세요',
    primary: false,
  },
] as const

interface ActionPanelProps {
  title: string
  /** 실어 갈 종목. 종목명을 아직 모르면 null — 두 줄을 링크로 두지 않는다 */
  stock: StockInfo | null
  /** 비로그인이면 로그인 주소(로그인하면 이 상세로 돌아온다). 로그인했으면 null */
  loginPath: string | null
}

/**
 * 정보 열의 바로 가기 두 단추. 단추가 곧 링크다 — 이 종목을 실어 그 화면으로 가서 곧바로 실행한다
 * (받는 화면이 한 번만 읽는다 — hooks/useStockHandoff). DB·서버 AI만 쓰고 증권사를 부르지 않는다.
 * 비로그인은 두 화면 다 결과를 못 보므로 "로그인 필요"를 달고 로그인으로 보낸다
 */
function ActionPanel({ title, stock, loginPath }: ActionPanelProps) {
  const titleId = useId()
  return (
    <section className={styles.actionPanel} aria-labelledby={titleId}>
      {/* 제목은 읽어 주는 기기에만 둔다 — 화면에서는 종목명과 단추 글이 이미 말한다 */}
      <h2 id={titleId} className={styles.visuallyHidden}>
        {title}
      </h2>
      <ul className={styles.actionList}>
        {ACTIONS.map((action) => (
          <li key={action.to}>
            <ActionRow action={action} stock={stock} loginPath={loginPath} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ActionRow({
  action,
  stock,
  loginPath,
}: {
  action: (typeof ACTIONS)[number]
  stock: StockInfo | null
  loginPath: string | null
}) {
  const nameId = useId()
  const descId = useId()
  const content = (
    <>
      <span id={nameId} className={styles.actionName}>
        {action.name}
        {loginPath !== null && <span className={styles.actionBadge}>로그인 필요</span>}
      </span>
      {/* 설명 한 줄은 읽어 주는 기기에만 들린다(aria-describedby). 화면에서는 단추 글이 할 일을 말한다 */}
      <span id={descId} className={styles.visuallyHidden}>
        {action.desc}
      </span>
    </>
  )
  // 단추 모양은 한 종류만 단다 — primary·secondary를 같이 달면 뒤에 정의된 쪽이 바탕을 덮는다
  const className = action.primary ? styles.actionRowPrimary : styles.actionRow
  // 이름은 제목(과 배지), 설명은 따로 읽힌다 — 줄 전체 글이 이름이 되면 길어서 무엇인지 늦게 들린다
  const a11y = { 'aria-labelledby': nameId, 'aria-describedby': descId }

  if (loginPath !== null) {
    return (
      <Link to={loginPath} className={className} {...a11y}>
        {content}
      </Link>
    )
  }
  if (stock === null) {
    return (
      <div className={styles.actionRowDisabled} aria-disabled="true">
        {content}
      </div>
    )
  }
  return (
    <Link to={action.to} state={toStockHandoff(stock)} className={className} {...a11y}>
      {content}
    </Link>
  )
}

/**
 * 마지막 거래일의 시·고·저·거래량. 현재가 API는 이 값을 안 주고(현재가·등락률뿐), 일봉 테이블은 장 마감 후 확정값만
 * 들어가므로 "오늘"이 아니라 어느 날인지 함께 적는다. 응답 전에는 같은 칸을 뼈대로 그려 둔다.
 * 고가·저가는 등락이 아니라 색을 주지 않는다(빨강·파랑은 등락 전용)
 */
function SummaryCard({ lastCandle, loading }: { lastCandle: Candle | null; loading: boolean }) {
  const date = lastCandle === null ? '' : toKoreanDate(lastCandle.date)
  const values =
    lastCandle === null
      ? null
      : [formatPrice(lastCandle.open), formatPrice(lastCandle.high), formatPrice(lastCandle.low), formatVolume(lastCandle.volume)]

  if (!loading && values === null) return null

  return (
    <section className={styles.summaryCard} aria-label="시세 요약">
      <div className={styles.summaryHead}>
        <h2 className={styles.summaryTitle}>시세 요약</h2>
        {loading ? (
          <span className={styles.summaryDate}>
            <span className={`${styles.textSkeleton} ${styles.dateSkeleton}`} />
          </span>
        ) : (
          date !== '' && <span className={styles.summaryDate}>{date} 마감 기준</span>
        )}
      </div>
      <dl className={styles.summary}>
        {SUMMARY_LABELS.map((label, index) => (
          <div key={label}>
            <dt className={styles.summaryLabel}>{label}</dt>
            <dd className={styles.summaryValue}>
              {values === null ? (
                <span className={`${styles.textSkeleton} ${styles.valueSkeleton}`} />
              ) : (
                values[index]
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

interface PriceSectionProps {
  stockCode: string | undefined
  /** 아직 받아오기 전이면 null. 자리만 잡아 두고 차트 자리에 뼈대를 그린다 */
  detail: StockDetail | null
  /** 목록에서 들고 온 이름·기준일 종가. detail이 오기 전에만 쓴다 */
  preview: StockPreview | null
  period: Period
  onPeriodChange: (period: Period) => void
  /** 실패해서 다시 부르기를 기다리는 중이면 언제 보내는지. 차트 자리에 남은 시간을 적는다 */
  waiting: { until: number } | null
  /** 종목 정보를 못 받았다. 가격·탭·차트 자리를 안내 상자 하나로 바꾼다 */
  failed: boolean
  onRetry: () => void
  /** 종목명 옆 관심종목 토글(LikeToggle) */
  likeToggle: ReactNode
  /** 관심종목 목록을 못 받았거나 토글을 되돌렸을 때의 안내. 없으면 null */
  likeStatus: ReactNode
  /** 오른쪽 열 바로 가기 카드(ActionPanel) */
  actionPanel: ReactNode
}

/** 이름·현재가·차트 카드(기간 탭 포함)·오른쪽 열(바로 가기·시세 요약). 구역 오류 경계 안에서 그려진다 */
function PriceSection({
  stockCode,
  detail,
  preview,
  period,
  onPeriodChange,
  waiting,
  failed,
  onRetry,
  likeToggle,
  likeStatus,
  actionPanel,
}: PriceSectionProps) {
  const shown = detail === null ? [] : sliceByPeriod(detail.candles, period)
  const lastCandle = shown.at(-1) ?? null
  const displayName = detail === null ? null : nameOrCode(detail.stockName, stockCode)

  /*
   * 실패는 이 구역 안에서만 알린다. 예전엔 화면 전체를 안내 한 줄로 바꿔, 따로 받는 뉴스까지 사라지고
   * 안내가 왼쪽 위에 붙었다. 이름 줄(모르면 종목코드)과 홈 링크는 두고, 탭·차트 자리를 정상 차트 카드와
   * 같은 높이의 상자 하나로 바꿔 가운데에 알린다. 다시 시도는 종목 정보만 다시 받는다(뉴스는 그대로).
   */
  if (failed) {
    /*
     * 목록에서 들고 온 기준일 종가가 있으면 그거라도 적는다.
     *
     * 상세 응답은 현재가(증권사)와 일봉(DB)을 함께 담는데, 증권사 쪽이 흔들리면 응답 전체가 500이라
     * 일봉까지 못 받는다(2026-10-04 확인). 그때 화면을 통째로 "불러오지 못했습니다"로 두면,
     * 바로 앞 목록에서 이미 보고 온 종가조차 사라져 아무것도 모르는 화면이 된다.
     *
     * 이 값은 현재가가 아니라 기준일 종가다. PriceLines가 날짜를 함께 적어 구분해 준다.
     */
    const hasPreviewPrice = preview?.closePrice !== undefined

    return (
      <section className={styles.priceGrid}>
        <div className={styles.head}>
          <Link to="/" className={styles.back}>
            <span aria-hidden="true">‹</span> 홈으로 돌아가기
          </Link>
          <div className={styles.identityRow}>
            {/* 이름을 모르면 종목코드를 이름 자리에 한 번만 적는다 */}
            <h1 className={styles.identity}>
              <span className={styles.name}>{preview?.stockName ?? stockCode}</span>
              {preview !== null && <span className={styles.code}>{stockCode}</span>}
            </h1>
            {likeToggle}
          </div>
          {likeStatus}

          {hasPreviewPrice && <PriceLines detail={null} preview={preview} />}
        </div>

        {/* 상세가 실패해도(대개 증권사 쪽) 바로 가기는 DB·서버 AI라 쓸 수 있다 */}
        <div className={styles.acts}>{actionPanel}</div>
        <div className={styles.chartColumn}>
          <div className={`${styles.chartBox} ${styles.failBox}`} role="alert">
            {/* 가격을 적어 뒀으면 못 받은 건 차트뿐이다. 다 못 받은 것처럼 말하지 않는다 */}
            <p className={styles.failText}>
              {hasPreviewPrice
                ? '차트를 불러오지 못했습니다'
                : '종목 정보를 불러오지 못했습니다'}
            </p>
            <button type="button" className={styles.retryButton} onClick={onRetry}>
              다시 시도
            </button>
          </div>
        </div>
      </section>
    )
  }

  /*
   * 정보 열(이름·가격 → 두 행동 → 시세 요약) | 차트 열(기간 탭·차트·기간별 변화). 휴대폰은 한 줄로 쌓되
   * 이름·가격 → 두 행동 → 차트 → 시세 요약 순이다 — 격자 칸 이름으로 순서를 바꾼다(StockChartPage.module.css .priceGrid)
   */
  return (
    <section className={styles.priceGrid} aria-busy={detail === null}>
      <div className={styles.head}>
        {/* 뒤로 가기 말고는 목록으로 돌아갈 길이 없었다 */}
        <Link to="/" className={styles.back}>
          <span aria-hidden="true">‹</span> 홈으로 돌아가기
        </Link>

        <div className={styles.identityRow}>
          <h1 className={styles.identity}>
            {/* 이름은 응답에 실려 온다. 목록에서 들고 왔으면 그걸 먼저 쓰고, 없으면 뼈대를 둔다 */}
            <span className={styles.name}>
              {detail !== null ? (
                displayName
              ) : preview !== null ? (
                preview.stockName
              ) : (
                <span className={`${styles.textSkeleton} ${styles.nameSkeleton}`} />
              )}
            </span>
            {/* 이름이 비어 종목코드로 대신했으면 코드를 두 번 적지 않는다 */}
            {displayName !== stockCode && <span className={styles.code}>{stockCode}</span>}
          </h1>
          {likeToggle}
        </div>
        {likeStatus}

        <PriceLines detail={detail} preview={preview} />
      </div>

      <div className={styles.acts}>{actionPanel}</div>

      <div className={styles.chartColumn}>
        <div className={styles.chartBox}>
          {/* 탭이 곧 확대·축소다. 받아 둔 전체 일봉을 여기서 잘라 차트에 넘긴다 */}
          <div className={styles.periodTabs} role="tablist" aria-label="기간">
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab.period}
                type="button"
                role="tab"
                aria-selected={tab.period === period}
                className={
                  tab.period === period
                    ? styles.periodTabActive
                    : styles.periodTab
                }
                onClick={() => onPeriodChange(tab.period)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.plot}>
            {detail === null && waiting !== null && (
              <WaitNotice until={waiting.until} />
            )}
            {detail === null && waiting === null && <div className={styles.chartSkeleton} />}

            {detail !== null && shown.length === 0 && (
              <p className={styles.chartMessage}>이 기간에는 거래일이 없습니다.</p>
            )}

            {shown.length > 0 && <CandleChart candles={shown} />}
          </div>
        </div>

        {detail !== null && <PeriodStats candles={detail.candles} />}
      </div>

      <div className={styles.sum}>
        <SummaryCard lastCandle={lastCandle} loading={detail === null} />
      </div>
    </section>
  )
}

/** 기간별 주가 변화 칸. 기간 탭과 같은 순서·이름이다(3년·전체는 뺀다 — 1년 최고·최저가 그 자리를 쓴다) */
const STAT_PERIODS: { period: Period; label: string }[] = PERIOD_TABS.filter(
  (tab) => tab.period !== 'THREE_YEAR' && tab.period !== 'ALL',
)

/**
 * 기간별 주가 변화와 1년 최고·최저(2026-10-30 사용자 결정 — 16:9에서 차트 아래가 비었다).
 * 상세가 이미 받은 전체 일봉(period=ALL)으로 계산해 요청은 늘지 않는다. 기준은 마지막 일봉의 종가이고,
 * 시작일은 기간 탭과 같은 규칙(periodStart)이다 — 그 날 이후 첫 거래일의 종가와 견준다.
 * 계산할 수 없는 칸(그 기간에 일봉이 없거나 종가가 0)은 "-"다
 */
function PeriodStats({ candles }: { candles: Candle[] }) {
  const last = candles.at(-1)
  if (last === undefined) return null

  const rates = STAT_PERIODS.map(({ period, label }) => {
    const start = periodStart(last.date, period)
    const first = start === null ? undefined : candles.find((c) => c.date >= start)
    const rate =
      first === undefined || first.close === 0 ? null : (last.close / first.close - 1) * 100
    return { period, label, rate }
  })

  const yearStart = periodStart(last.date, 'ONE_YEAR')
  const year = yearStart === null ? candles : candles.filter((c) => c.date >= yearStart)
  const high = year.reduce((top, c) => (c.high > top.high ? c : top), year[0])
  const low = year.reduce((bottom, c) => (c.low < bottom.low ? c : bottom), year[0])
  const baseDate = toKoreanDate(last.date)

  return (
    <section className={styles.periodStats} aria-label="기간별 주가 변화">
      <dl className={styles.statList}>
        {rates.map(({ period, label, rate }) => (
          <div key={period} className={styles.stat}>
            <dt>{label}</dt>
            <dd className={toRateClassName(rate)}>{formatChangeRate(rate)}</dd>
          </div>
        ))}
        <div className={`${styles.stat} ${styles.statWide}`}>
          <dt>1년 최고</dt>
          <dd>
            {formatPrice(high.high)}
            <small>{toKoreanDate(high.date)}</small>
          </dd>
        </div>
        <div className={`${styles.stat} ${styles.statWide}`}>
          <dt>1년 최저</dt>
          <dd>
            {formatPrice(low.low)}
            <small>{toKoreanDate(low.date)}</small>
          </dd>
        </div>
      </dl>
      {baseDate !== '' && <p className={styles.statNote}>{baseDate} 종가 기준</p>}
    </section>
  )
}

/**
 * 실패해서 다시 부르기를 기다리는 동안 차트 자리에 적는 안내. 남은 초를 센다.
 * 말없이 뼈대만 1분 가까이 두면 멈춘 것처럼 보여서, 언제 다시 부르는지를 적는다.
 */
function WaitNotice({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    // 1초마다 세면 타이머가 조금씩 밀려 숫자를 건너뛸 때가 있어 더 자주 본다
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  // 0초는 적지 않는다. 그때는 이미 요청을 보내 '불러오는 중'으로 바뀐다
  const seconds = Math.max(1, Math.ceil((until - now) / 1000))

  return (
    <div className={styles.chartWait}>
      <p className={styles.chartWaitTitle}>{seconds}초 뒤에 차트를 다시 불러옵니다</p>
      <p className={styles.chartMessage}>서버가 잠시 응답하지 못했습니다.</p>
    </div>
  )
}

/**
 * 가격 두 줄. 응답이 오면 현재가·전일 대비, 오기 전엔 목록에서 들고 온 기준일 종가를
 * 흐리게 날짜와 함께 적고(현재가로 읽히면 안 된다), 그것도 없으면 뼈대를 둔다.
 * 예전엔 오기 전에도 "-"를 적어 값이 없는 것과 오는 중인 것을 가를 수 없었다.
 */
function PriceLines({
  detail,
  preview,
}: {
  detail: StockDetail | null
  preview: StockPreview | null
}) {
  if (detail !== null) {
    return (
      <>
        <p className={styles.price}>
          <PriceText value={detail.currentPrice} />
        </p>
        <p className={styles.change}>
          전일 대비{' '}
          <span className={toRateClassName(detail.comparePrev)}>
            {formatChangeRate(detail.comparePrev)}
          </span>
          {/* 현재가는 증권사 실시간 값이라 언제 받았는지 적는다. 아래 시세 요약은 마지막 거래일 마감 값이다 */}
          {toKoreanDateTime(detail.receivedAt) !== '' && (
            <span className={styles.asOf}>{toKoreanDateTime(detail.receivedAt)} 기준</span>
          )}
        </p>
      </>
    )
  }

  if (preview?.closePrice !== undefined) {
    return (
      <>
        <p className={`${styles.price} ${styles.pricePending}`}>
          <PriceText value={preview.closePrice} />
        </p>
        <p className={styles.change}>
          {toKoreanDate(preview.baseDate)} 종가
          {preview.fluctuate !== undefined && (
            <>
              {' · 전일 대비 '}
              <span className={toRateClassName(preview.fluctuate)}>
                {formatChangeRate(preview.fluctuate)}
              </span>
            </>
          )}
        </p>
      </>
    )
  }

  return (
    <>
      <p className={styles.price}>
        <span className={`${styles.textSkeleton} ${styles.priceSkeleton}`} />
      </p>
      <p className={styles.change}>
        <span className={`${styles.textSkeleton} ${styles.changeSkeleton}`} />
      </p>
    </>
  )
}

/**
 * 큰 가격. 숫자는 로고와 같은 넓은 글꼴(--font-wide), "원"은 본문 글꼴로 작게 적는다(시안 B).
 * 넓은 글꼴의 % 기호·한글은 어색해 숫자만 넓은 글꼴로 둔다. 값이 없으면 "-" 그대로다
 */
function PriceText({ value }: { value: number | null | undefined }) {
  const text = formatPrice(value)
  if (!text.endsWith('원')) return text
  return (
    <>
      <span className={styles.priceNumber}>{text.slice(0, -1)}</span>
      <span className={styles.priceUnit}>원</span>
    </>
  )
}
