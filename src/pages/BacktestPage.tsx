import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { STOCK_LIST } from '../api/stockList'
import type { StockInfo } from '../types/stock'
import type { BacktestPeriod, BacktestPreset } from '../types/backtest'
import type { PersonalityType } from '../types/personality'
import {
  AXES,
  AXIS_LABEL,
  INVEST_TYPES,
  PERIODS,
  calculateAxisScores,
  findInvestType,
  periodLabel,
  scoreVerdict,
  supportedPeriods,
  toPercent,
} from '../utils/backtest'
import { getPreset, getPresetOptions } from '../api/backtest'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useSavedPersonality } from '../hooks/useSavedPersonality'
import { UserFacingError, toUserMessage } from '../utils/error'
import { useCountUp, useGrown } from '../hooks/useReveal'
import type { PresetOption } from '../api/backtest'
import styles from './BacktestPage.module.css'

/**
 * 종목의 성향을 가릴 때 쓰는 기준 기간. 전략 5개를 견주려면 같은 기간이어야 하는데
 * 최소 기간이 제각각이라(이동평균 교차는 6개월부터) 다섯이 모두 갖춘 기간으로 고정한다.
 */
const COMPARE_PERIOD: BacktestPeriod = 'ONE_YEAR'

/** 한 번에 보여줄 검색 결과 수. 목록이 길어지면 고르기가 더 어려워진다 */
const MAX_MATCHES = 7

/**
 * 받침이 있으면 '은', 없으면 '는'.
 * 한글이 아니면(NAVER 등) '는'이 자연스러워 기본값으로 둔다.
 */
function withTopicParticle(word: string): string {
  const last = word.charCodeAt(word.length - 1)
  const isHangul = last >= 0xac00 && last <= 0xd7a3
  if (!isHangul) return `${word}는`
  return (last - 0xac00) % 28 === 0 ? `${word}는` : `${word}은`
}

/** 성향테스트를 하러 가는 곳. 아직 본 앱 라우트가 아니라 별도 엔트리다 */
const PERSONALITY_TEST_URL = '/personality-test'

export default function BacktestPage() {
  useDocumentTitle('주식 백테스트')

  const [query, setQuery] = useState('')
  const [stock, setStock] = useState<StockInfo | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  /**
   * 방향키로 짚고 있는 후보의 자리. -1이면 아무것도 안 짚은 상태다.
   * '고른 종목'(stock)과 달리 목록을 닫으면 없던 일이 된다.
   */
  const [activeIndex, setActiveIndex] = useState(-1)
  /* 기간 목록도 1단계와 같은 방식으로 연다. 열림 여부와 짚은 자리 */
  const [isPeriodOpen, setIsPeriodOpen] = useState(false)
  const [periodIndex, setPeriodIndex] = useState(-1)

  /*
   * 전략을 미리 골라 두지 않는다. 서버가 성향 번호 하나로 전략까지 정하지만
   * "안정형이니까 이 전략"이라고 말할 근거가 백엔드 어디에도 없다. 없는 인과를
   * 지어내지 않도록 전략은 사용자가 고르고, 견주는 일은 결과에서만 한다.
   */
  const [investType, setInvestType] = useState<number | null>(null)
  const [period, setPeriod] = useState<BacktestPeriod | null>(null)
  const [preset, setPreset] = useState<BacktestPreset | null>(null)
  /* 저장된 내 성향. 로그인 안 했거나 검사 전이면 null이고 화면이 그 경우를 그린다 */
  const savedPersonality = useSavedPersonality()
  /* 조회 중·실패 문구·다섯 성향 순위. 셋 다 위 preset을 받아오는 과정의 상태다 */
  const [isRunning, setIsRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [ranking, setRanking] = useState<Ranked[]>([])

  /*
   * 기간 목록은 서버가 진짜지만 화면이 열리자마자 그려야 해서 사본으로 먼저 그리고
   * 응답이 오면 갈아끼운다. 못 받아도 사본으로 쓸 수 있어 실패를 알리지 않는다.
   */
  const [serverOptions, setServerOptions] = useState<PresetOption[] | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const selected = investType === null ? null : findInvestType(investType)
  /* 서버 목록이 도착했으면 그걸 쓰고, 아직이면(또는 실패했으면) 사본을 쓴다 */
  const periodChoices = useMemo(() => {
    if (investType === null) return []

    const fromServer = serverOptions?.find(
      (item) => item.investType === investType,
    )
    if (fromServer !== undefined) {
      return fromServer.periods.map((item) => item.period)
    }
    return supportedPeriods(investType)
  }, [investType, serverOptions])
  /* 화면에 그릴 기간 목록. 전략이 지원하는 것만 남는다 */
  const periodOptions = useMemo(
    () => PERIODS.filter((item) => periodChoices.includes(item.period)),
    [periodChoices],
  )
  const canRun = stock !== null && investType !== null && period !== null

  const matches = useMemo(() => {
    const keyword = query.trim()
    if (!keyword) return []
    // 고른 종목의 이름이 그대로 적혀 있으면 다시 펼칠 이유가 없다
    if (stock !== null && keyword === stock.stockName) return []

    return STOCK_LIST.filter(
      (item) =>
        item.stockName.includes(keyword) || item.stockCode.startsWith(keyword),
    ).slice(0, MAX_MATCHES)
  }, [query, stock])

  /*
   * 성향별 기간 목록을 한 번만 받아 둔다. 종목과 무관해서 화면당 한 번이면 된다.
   * 실패해도 사본이 있으므로 조용히 넘어간다.
   */
  useEffect(() => {
    let cancelled = false

    getPresetOptions()
      .then((options) => {
        if (!cancelled) setServerOptions(options)
      })
      .catch(() => {
        // 사본으로 계속 쓴다. 사용자에게 알릴 내용이 아니다
      })

    return () => {
      cancelled = true
    }
  }, [])

  /*
   * 서버 목록이 뒤늦게 도착해 기간이 좁아졌으면 이미 고른 것을 놓아 준다.
   * 사본이 서버보다 넓으면 선택칸은 빈칸인데 '시작하기'는 눌리는 상태가 된다.
   */
  useEffect(() => {
    if (period !== null && !periodChoices.includes(period)) {
      setPeriod(null)
    }
  }, [periodChoices, period])

  /*
   * 조건을 건드리면 이전 결과는 더 이상 그 조건의 결과가 아니다.
   * 남겨 두면 화면의 입력과 결과가 어긋난 채로 보인다.
   */
  function clearResult() {
    setPreset(null)
    setRanking([])
    setRunError(null)
  }

  function handleQueryChange(value: string) {
    setQuery(value)
    setStock(null)
    setIsSearchOpen(true)
    // 글자가 바뀌면 후보 목록이 통째로 달라진다. 짚고 있던 자리는 뜻을 잃는다
    setActiveIndex(-1)
    clearResult()
  }

  function selectStock(item: StockInfo) {
    setStock(item)
    setQuery(item.stockName)
    setIsSearchOpen(false)
    setActiveIndex(-1)
    clearResult()
  }

  /**
   * 검색칸을 키보드만으로 다룬다. ↓↑로 훑고 엔터로 고른다.
   *
   * 엔터는 방향키로 짚어 둔 것, 없으면 후보가 하나뿐일 때만 그것을 고른다. 여럿
   * 남았는데 안 짚었으면 아무 일도 안 한다 — 고른 종목이 곧 백테스트 대상이라
   * 엉뚱한 게 잡히면 다른 종목의 결과를 모른 채 본다('삼성'만 쳐도 일곱 개다).
   *
   * isComposing은 엔터에만 본다. 한글은 마지막 글자가 조합 중으로 남아 있어서
   * ('삼성'의 '성') 방향키까지 막으면 다 치고 ↓를 눌러도 안 먹는다. 반대로 조합
   * 중의 엔터는 글자를 확정하겠다는 뜻이라, 안 거르면 치다가 바로 골라져 버린다.
   */
  function handleStockKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (matches.length === 0) return
      /* 막지 않으면 글자 커서가 맨 앞·맨 뒤로 튄다 */
      event.preventDefault()
      setIsSearchOpen(true)

      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => {
        const next = current + step
        // 끝에서 반대편으로 돌아온다. 아무것도 안 짚었을 때(-1) ↑는 맨 아래로 간다
        if (next < 0) return matches.length - 1
        if (next >= matches.length) return 0
        return next
      })
      return
    }

    if (event.key === 'Escape') {
      setIsSearchOpen(false)
      setActiveIndex(-1)
      return
    }

    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return

    const target =
      activeIndex >= 0
        ? matches[activeIndex]
        : matches.length === 1
          ? matches[0]
          : undefined
    if (target === undefined) return

    event.preventDefault()
    selectStock(target)
  }

  function selectPeriod(next: BacktestPeriod) {
    setPeriod(next)
    setIsPeriodOpen(false)
    setPeriodIndex(-1)
    clearResult()
  }

  /**
   * 기간 목록의 키보드 조작. 1단계 검색과 같은 규칙인데 글자를 칠 수 없어
   * isComposing 검사가 없고, 닫혀 있을 때 ↓를 누르면 열면서 첫 칸을 짚는다.
   */
  function handlePeriodKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape') {
      setIsPeriodOpen(false)
      setPeriodIndex(-1)
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (periodOptions.length === 0) return
      event.preventDefault()
      setIsPeriodOpen(true)

      const step = event.key === 'ArrowDown' ? 1 : -1
      setPeriodIndex((current) => {
        const next = current + step
        if (next < 0) return periodOptions.length - 1
        if (next >= periodOptions.length) return 0
        return next
      })
      return
    }

    if (event.key !== 'Enter' && event.key !== ' ') return

    /*
     * 닫힌 상태의 엔터·스페이스는 여는 것이지 고르는 게 아니다.
     * 버튼의 기본 동작(onClick)이 그 일을 하므로 여기서는 아무것도 하지 않는다.
     */
    if (!isPeriodOpen || periodIndex < 0) return

    event.preventDefault()
    selectPeriod(periodOptions[periodIndex].period)
  }

  /**
   * 전략마다 고를 수 있는 기간이 달라서, 전략을 바꾸면 못 쓰게 된 기간을 놓아 준다.
   * 안 놓아 주면 화면에는 3개월이 적혀 있는데 서버는 400을 주는 상태가 된다.
   */
  function changeStrategy(next: number | null) {
    setInvestType(next)
    // 전략이 바뀌면 고를 수 있는 기간이 달라진다. 열린 목록은 옛 목록이다
    setIsPeriodOpen(false)
    setPeriodIndex(-1)
    if (next !== null && period !== null) {
      if (!supportedPeriods(next).includes(period)) {
        setPeriod(null)
      }
    }
    clearResult()
  }

  /**
   * 고른 조건의 결과 하나와, 종목 성향을 가리기 위한 다섯 전략의 점수를 받는다.
   * 결과 화면이 두 값을 다 있어야 그리므로 한 번의 누름으로 둘 다 채운다.
   *
   * 고른 것 하나를 먼저 받고 비교용 다섯을 뒤이어 보낸다(아래 주석 참고).
   * 여섯 번을 보내도 되는 건 전부 DB 조회라 호출 제한이 없어서다.
   */
  async function handleSubmit() {
    if (stock === null || investType === null || period === null) return

    setIsRunning(true)
    setRunError(null)
    setPreset(null)
    setRanking([])

    try {
      /*
       * 한 묶음(Promise.all)으로 받다가 나눴다. 곁다리 하나가 400을 맞으면 사용자가
       * 실제로 고른 결과까지 함께 버려지기 때문이다.
       */
      const chosen = await getPreset(stock.stockCode, investType, period)

      setPreset(chosen)

      /* 받은 것만 줄 세운다. 넷만 와도 순위는 그릴 수 있다 */
      const settled = await Promise.allSettled(
        INVEST_TYPES.map((item) =>
          getPreset(stock.stockCode, item.investType, COMPARE_PERIOD),
        ),
      )
      const others = settled
        .filter((item) => item.status === 'fulfilled')
        .map((item) => item.value)

      /*
       * 하나도 못 받으면 종목 성향을 가릴 수 없다. 결과 화면이 그 비교를 중심으로
       * 짜여 있어 반쪽으로는 그릴 게 없으므로, 예전처럼 에러 화면으로 보낸다.
       */
      if (others.length === 0) {
        throw new UserFacingError(
          '종목의 성향을 비교할 자료를 받지 못했습니다.',
        )
      }

      /*
       * 점수 순이 아니라 성향 번호 순(안정형 → 공격투자형)으로 세운다.
       * 점수로 줄 세우면 종목마다 순서가 바뀌어 매번 "안정형이 어디 있지"를 찾아야 하고,
       * 다섯이 순한 것에서 센 것으로 이어지는 한 줄이라는 것도 안 보인다.
       * 1위는 순서가 아니라 왕관과 색으로 표시한다.
       */
      setRanking(
        others
          .map((item) => ({
            investType: item.investType,
            score: item.result.finalScore,
          }))
          .sort((left, right) => left.investType - right.investType),
      )
    } catch (error: unknown) {
      // UserFacingError는 그대로, 통신 실패는 사람 말로. 예전엔 개발자용 문구가 그대로 떴다
      setRunError(toUserMessage(error, '백테스트 결과를 찾지 못했습니다.'))
    } finally {
      setIsRunning(false)
    }
  }

  /*
   * 결과는 폼 아래에 그려진다. 버튼을 눌러도 화면이 그대로면 무엇이 달라졌는지 알 수 없어
   * 결과가 생기는 순간 그쪽으로 내린다. 결과를 지울 때(다시하기)는 움직이지 않는다.
   */
  useEffect(() => {
    if (preset === null || resultRef.current === null) return

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    resultRef.current.scrollIntoView({
      behavior: prefersReduced ? 'auto' : 'smooth',
      block: 'start',
    })
  }, [preset])

  return (
    <div className={styles.layout}>
      <div className={styles.content}>
        <h1 className={styles.title}>주식 백테스트 이용하기</h1>

        {/*
          성향은 고르는 칸이 아니라 '이미 정해진 나의 정보'다. 사실만 적고
          전략과 이어 붙이지 않는다. 둘을 견주는 일은 결과에서만 한다.
        */}
        <div className={styles.myBanner}>
          {savedPersonality === null ? (
            <>
              <p className={styles.myText}>
                투자성향테스트를 아직 안 하셨어요. 먼저 하면 결과에서 종목과
                견줘볼 수 있어요.
              </p>
              <Link className={styles.myAction} to={PERSONALITY_TEST_URL}>
                테스트하러 가기
              </Link>
            </>
          ) : (
            <>
              <p className={styles.myText}>
                내 투자성향은 <b>{savedPersonality}</b>이에요.
              </p>
              <Link className={styles.myAction} to={PERSONALITY_TEST_URL}>
                다시 테스트
              </Link>
            </>
          )}
        </div>

        <section className={styles.form}>
          {/* 종목 선택 --------------------------------------------------- */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="backtest-stock">
              <span className={styles.step}>1</span>
              종목 선택
            </label>

            <div className={styles.searchWrap}>
              <div className={styles.control}>
                <input
                  id="backtest-stock"
                  className={styles.input}
                  type="text"
                  value={query}
                  placeholder="종목을 검색해주세요. (예: 삼성전자)"
                  autoComplete="off"
                  /*
                   * '삼성전자'·'HD현대일렉트릭' 같은 이름은 사전에 없어서 브라우저가
                   * 빨간 물결선을 긋는다. 제대로 친 종목명이 오타처럼 보인다.
                   */
                  spellCheck={false}
                  onChange={(event) => handleQueryChange(event.target.value)}
                  onFocus={() => setIsSearchOpen(true)}
                  onBlur={() => setIsSearchOpen(false)}
                  onKeyDown={handleStockKeyDown}
                  /*
                   * '아래에 고를 목록이 딸린 입력칸'이라고 알린다. focus는 입력칸에
                   * 있어야 글자를 계속 칠 수 있어서 짚은 자리는 이 속성으로만 전한다.
                   */
                  role="combobox"
                  aria-expanded={isSearchOpen && matches.length > 0}
                  aria-controls="backtest-stock-list"
                  aria-autocomplete="list"
                  aria-activedescendant={
                    activeIndex >= 0
                      ? `backtest-stock-option-${activeIndex}`
                      : undefined
                  }
                />
                {stock !== null && (
                  <span className={styles.code}>{stock.stockCode}</span>
                )}
              </div>

              {isSearchOpen && matches.length > 0 && (
                /*
                 * 목록을 누르면 입력칸이 먼저 focus를 잃어 목록이 닫히고 클릭이 사라진다.
                 * mousedown을 막아 focus를 붙잡아 둔다.
                 */
                <ul
                  id="backtest-stock-list"
                  role="listbox"
                  className={styles.matches}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  {matches.map((item, index) => (
                    /* 목록의 칸은 아래 button이다. li는 자리만 잡는다 */
                    <li key={item.stockCode} role="presentation">
                      <button
                        type="button"
                        id={`backtest-stock-option-${index}`}
                        role="option"
                        aria-selected={index === activeIndex}
                        className={
                          index === activeIndex
                            ? `${styles.match} ${styles.matchActive}`
                            : styles.match
                        }
                        onClick={() => selectStock(item)}
                        // 안 옮기면 키보드가 짚은 칸과 마우스가 얹힌 칸이 따로 밝아진다
                        onMouseEnter={() => setActiveIndex(index)}
                      >
                        <span>{item.stockName}</span>
                        <span className={styles.code}>{item.stockCode}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* 투자전략 선택 ------------------------------------------------ */}
          {/*
            전략을 고르는 곳은 **여기 하나뿐이다.**

            예전에는 여기에 이름만 나열한 드롭다운을 두고, 오른쪽 가이드에도 누를 수 있는
            같은 목록을 뒀다. 고르는 곳이 둘이라 "이 둘이 다른 건가" 하고 멈칫하게 됐고,
            무엇보다 드롭다운은 '돌파 전략' 같은 이름만 보여줘서 처음 온 사람이 고를 근거가
            없었다 — 근거는 전부 오른쪽에 있어서 눈을 옮겼다 돌아와야 했다.

            이름과 한 줄 설명을 함께 담은 카드로 바꿔 근거를 고르는 자리로 가져왔다.
            오른쪽 가이드는 '고른 전략의 자세한 조건'과 개념 설명만 맡는다.
          */}
          <div
            className={styles.field}
            /*
             * fieldset이 아니라 role="group"이다. fieldset은 기본 여백·테두리가 붙고
             * legend가 flex 안에서 제멋대로 놓여 1·3단계와 줄이 안 맞는다.
             */
            role="group"
            aria-labelledby="backtest-strategy-label"
          >
            <p className={styles.label} id="backtest-strategy-label">
              <span className={styles.step}>2</span>
              투자전략 선택
            </p>

            <ul className={styles.strategyPick}>
              {INVEST_TYPES.map((item) => {
                const isActive = item.investType === investType

                return (
                  <li key={item.investType}>
                    <button
                      type="button"
                      className={
                        isActive
                          ? `${styles.pick} ${styles.pickOn}`
                          : styles.pick
                      }
                      /*
                       * 라디오 버튼 묶음처럼 읽히게 한다. 눌린 것 하나만 true라
                       * 화면을 읽어 주는 도구가 '5개 중 3번째, 선택됨'으로 전한다.
                       */
                      aria-pressed={isActive}
                      onClick={() => changeStrategy(item.investType)}
                    >
                      {/*
                        성향 이름도 번호도 붙이지 않는다. 순서를 보이는 순간
                        "앞이 안전하고 뒤가 위험하다"로 읽히는데, 그 순서는
                        백엔드가 성향 번호에 전략을 배정해 둔 결과일 뿐
                        전략의 위험도를 잰 값이 아니다.
                      */}
                      <span className={styles.pickName}>
                        {item.strategyName}
                      </span>
                      <span className={styles.pickDesc}>
                        {item.strategySummary}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            {/*
              고른 카드 바로 아래에 규칙을 편다.
              한때 이걸 오른쪽 가이드에 뒀는데, 매수·매도·기간은 읽고 마는 참고자료가
              아니라 **방금 고른 선택의 근거**다. 고른 자리에서 눈을 떼어 반대편 아래까지
              옮겨야 보이면 대부분 안 본다.
              게다가 '기간 3개월 이상'은 바로 다음 3단계에서 고를 수 있는 범위를 정한다.
              2와 3 사이가 제자리다.
            */}
            {selected !== null && (
              <div className={styles.pickDetail}>
                <span className={styles.detailRow}>
                  <b className={styles.buy}>매수</b>
                  {selected.entryRule}
                </span>
                <span className={styles.detailRow}>
                  <b className={styles.sell}>매도</b>
                  {selected.exitRule}
                </span>
                <span className={styles.detailRow}>
                  <b className={styles.term}>기간</b>
                  {periodLabel(selected.minPeriod)} 이상
                </span>
              </div>
            )}
          </div>

          {/* 투자기간 선택 ------------------------------------------------ */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="backtest-period">
              <span className={styles.step}>3</span>
              투자기간 선택
            </label>

            {/*
              1단계 종목 검색과 **같은 클래스를 쓴다**(.matches / .match / .matchActive).
              브라우저가 그리는 <select> 목록은 운영체제 것이라 앱 안에서 이 칸만
              모서리도 그림자도 없이 파란 띠로 뜬다. 같은 화면에 두 벌의 목록이
              다르게 생기는 셈이라 직접 그린다.

              고르는 값이 늘어나면 여기와 1단계가 함께 어긋나지 않도록 모양은
              한 벌만 두고 나눠 쓴다. 동작(방향키·엔터·Escape)도 같은 규칙이다.
            */}
            <div className={styles.searchWrap}>
              <button
                type="button"
                id="backtest-period"
                className={`${styles.control} ${styles.picker}`}
                disabled={investType === null}
                onClick={() => {
                  setIsPeriodOpen((open) => !open)
                  setPeriodIndex(-1)
                }}
                onKeyDown={handlePeriodKeyDown}
                /* 목록을 눌러 고르는 중에는 닫히면 안 된다 — 아래 ul이 mousedown을 막는다 */
                onBlur={() => {
                  setIsPeriodOpen(false)
                  setPeriodIndex(-1)
                }}
                role="combobox"
                aria-expanded={isPeriodOpen}
                aria-controls="backtest-period-list"
                aria-activedescendant={
                  periodIndex >= 0
                    ? `backtest-period-option-${periodIndex}`
                    : undefined
                }
              >
                <span
                  className={
                    period === null ? styles.pickerEmpty : styles.pickerValue
                  }
                >
                  {period === null
                    ? investType === null
                      ? '투자전략을 먼저 선택해주세요.'
                      : '투자기간을 선택해주세요.'
                    : periodLabel(period)}
                </span>
                {/* 열고 닫히는 방향을 화살표로 알린다. 장식이라 읽어 줄 필요가 없다 */}
                <svg
                  className={
                    isPeriodOpen
                      ? `${styles.chevron} ${styles.chevronUp}`
                      : styles.chevron
                  }
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    d="M5 8l5 5 5-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {isPeriodOpen && periodOptions.length > 0 && (
                <ul
                  id="backtest-period-list"
                  role="listbox"
                  className={styles.matches}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  {periodOptions.map((item, index) => (
                    <li key={item.period} role="presentation">
                      <button
                        type="button"
                        id={`backtest-period-option-${index}`}
                        role="option"
                        aria-selected={item.period === period}
                        className={
                          index === periodIndex
                            ? `${styles.match} ${styles.matchActive}`
                            : styles.match
                        }
                        onClick={() => selectPeriod(item.period)}
                        onMouseEnter={() => setPeriodIndex(index)}
                      >
                        <span>{periodLabel(item.period)}</span>
                        {/* 지금 고른 것에 표시를 남긴다. 다시 열었을 때 어디였는지 보인다 */}
                        {item.period === period && (
                          <span className={styles.pickedMark}>선택됨</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selected !== null && periodChoices.length < PERIODS.length && (
              <p className={styles.hint}>
                {selected.strategyName}은 지표를 계산하는 데 봉이 많이 필요해서{' '}
                <b>{periodLabel(selected.minPeriod)}</b> 이상만 고를 수 있어요.
              </p>
            )}
          </div>

          <div className={styles.submitRow}>
            <button
              type="button"
              className={styles.submit}
              disabled={!canRun || isRunning}
              onClick={handleSubmit}
            >
              {isRunning ? '불러오는 중…' : '백테스트 시작하기'}
            </button>

            {/*
              담긴 문구를 그대로 적는다. 예전에는 runError를 참·거짓으로만 쓰고
              "잠시 후 다시 눌러주세요"를 항상 띄웠는데, 원인이 '자료가 없다'일 때는
              기다려도 달라지지 않아 **틀린 안내**였다. 지금은 경우마다 다른 말이 나온다.
            */}
            {runError !== null && (
              <p className={styles.submitError} role="alert">
                {runError}
              </p>
            )}

            {/* 버튼이 꺼져 있는 이유를 말해 준다. 안 그러면 왜 안 눌리는지 알 길이 없다 */}
            {!canRun && (
              <p className={styles.submitHint}>
                {stock === null
                  ? '종목을 먼저 골라주세요.'
                  : investType === null
                    ? '투자전략을 골라주세요.'
                    : '투자기간을 골라주세요.'}
              </p>
            )}
          </div>
        </section>

        <div ref={resultRef}>
          {preset !== null && stock !== null && (
            <BacktestResult
              preset={preset}
              stockName={stock.stockName}
              ranking={ranking}
              savedPersonality={savedPersonality}
              onRetry={clearResult}
            />
          )}
        </div>
      </div>

      <BacktestGuide />
    </div>
  )
}

/* -------------------------------------------------------------------- *
 * 결과
 * -------------------------------------------------------------------- */

interface Ranked {
  investType: number
  score: number
}

interface ResultProps {
  preset: BacktestPreset
  stockName: string
  /** 다섯 전략의 적합도를 높은 순으로. 첫 번째가 이 종목의 성향이다 */
  ranking: Ranked[]
  /** 저장된 내 성향. 없으면 종목 성향만 적고 견주기는 뺀다 */
  savedPersonality: PersonalityType | null
  onRetry: () => void
}

function BacktestResult({
  preset,
  stockName,
  ranking,
  savedPersonality,
  onRetry,
}: ResultProps) {
  const { result } = preset

  /*
   * 결과가 0에서 자라 올라오게 한다. 판정 문구는 움직이지 않는다 — 숫자가 오르는
   * 동안 말이 바뀌면 결론이 흔들리는 것처럼 읽힌다.
   * 아래 조기 반환보다 위에 있어야 한다. 훅은 그릴 때마다 같은 순서로 불려야 한다.
   */
  const grown = useGrown()

  const info = findInvestType(preset.investType)
  /*
   * 목록은 성향 번호 순으로 고정돼 있으므로 첫 줄이 1위가 아니다.
   * '이 종목의 성향'은 점수가 가장 높은 것을 따로 골라야 한다.
   */
  const best = ranking.reduce<Ranked | undefined>(
    (top, item) => (top === undefined || item.score > top.score ? item : top),
    undefined,
  )
  const bestInfo = best === undefined ? null : findInvestType(best.investType)
  if (info === null || bestInfo === null || best === undefined) return null

  const axisScores = calculateAxisScores(result)
  const verdict = scoreVerdict(result.finalScore)
  /** 종목이 나와 같은 성향으로 판정됐는가 */
  const isSame = savedPersonality === bestInfo.personality

  /*
   * 표로 늘어놓으면 숫자는 보이는데 뜻이 안 보인다("샤프비율 1.69"가 좋은지 나쁜지
   * 아는 사람은 적다). 값마다 한 줄 해설을 붙이고 어려운 말은 괄호로 푼다.
   */
  const metrics: {
    label: string
    value: string
    tone?: 'up' | 'down'
    desc: string
  }[] = [
    {
      label: '누적수익률',
      value: toPercent(result.profit.totalReturn),
      tone: result.profit.totalReturn >= 0 ? 'up' : 'down',
      desc: '이 기간에 전략을 그대로 따랐다면 이만큼 벌었어요',
    },
    {
      label: '연평균수익률',
      value: toPercent(result.profit.annualReturn),
      tone: result.profit.annualReturn >= 0 ? 'up' : 'down',
      desc: '1년치로 환산하면 이 정도 속도예요',
    },
    {
      label: '최대낙폭 (MDD)',
      value: toPercent(result.stable.mdd),
      desc: '가장 많이 물렸을 때 고점에서 이만큼 떨어졌어요',
    },
    {
      label: '위험 대비 수익 (샤프비율)',
      value: result.effect.sharpeRatio.toFixed(2),
      desc: '1을 넘으면 감수한 위험에 비해 잘 번 편이에요',
    },
    {
      label: '오르내림 (변동성)',
      value: toPercent(result.stable.volatility),
      desc: '클수록 가격이 심하게 출렁였어요',
    },
    {
      label: '거래횟수',
      value: `${result.growth.positionCount}회`,
      desc: '이 기간에 전략이 사고판 횟수예요',
    },
  ]

  return (
    <section className={styles.result}>
      <div className={styles.resultHead}>
        <h2 className={styles.resultTitle}>백테스트 결과</h2>

        <button type="button" className={styles.retry} onClick={onRetry}>
          백테스트 다시하기
        </button>
      </div>

      {/*
        읽는 사람이 가장 먼저 알아야 할 한 줄. 나와 종목, 둘만 견준다.

        여기에 고른 전략을 끼워 넣으면 안 된다. 종목의 성향은 다섯 전략을 모두
        돌려 가장 높게 나온 것으로 정하므로 **지금 고른 전략과 아무 상관이 없다.**
        예전 문구가 "○○ 전략으로 분석한 결과, 이 종목은 △△형"이라고 이어 붙였는데
        둘 사이에 인과가 없다.
      */}
      <div className={styles.compare}>
        <p className={styles.story}>
          {savedPersonality === null ? (
            <>
              {withTopicParticle(stockName)} <b>{bestInfo.personality}</b>에게
              가장 잘 맞는 종목이에요.
            </>
          ) : (
            <>
              나는 <b>{savedPersonality}</b>인데,{' '}
              {withTopicParticle(stockName)}{' '}
              <b className={isSame ? styles.good : styles.bad}>
                {bestInfo.personality}
              </b>
              에게 가장 잘 맞는 종목이에요.
            </>
          )}
        </p>

        <div className={styles.matchRow}>
          <div className={styles.matchSide}>
            <span className={styles.matchLabel}>내 투자성향</span>
            <strong className={styles.matchValue}>
              {savedPersonality ?? '아직 없어요'}
            </strong>
            <span className={styles.matchFrom}>투자성향테스트 결과</span>
          </div>

          <span className={styles.matchSign} aria-hidden="true">
            {isSame ? '=' : '↔'}
          </span>

          <div className={styles.matchSide}>
            <span className={styles.matchLabel}>{stockName}의 투자성향</span>
            <strong className={styles.matchValue}>
              {bestInfo.personality}
            </strong>
            <span className={styles.matchFrom}>
              적합도 {best.score.toFixed(1)}점으로 가장 높음
            </span>
          </div>
        </div>

        {savedPersonality !== null && !isSame && (
          <p className={styles.matchText}>
            성향이 서로 달라요. 내 성향대로 간다면 {stockName}보다 더 맞는
            종목이 있을 수 있어요.
          </p>
        )}
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          {info.strategyName}으로 본 {stockName}
        </h3>

        <div className={styles.scoreRow}>
          <div className={styles.scoreBox}>
            <span className={styles.scoreLabel}>적합도</span>
            <span className={styles.score}>
              <CountUp value={result.finalScore} digits={1} />
              <span className={styles.scoreMax}>/ 100</span>
            </span>
            <span
              className={`${styles.scoreVerdict} ${styles[verdict.tone]}`}
            >
              {verdict.short}
            </span>
          </div>

          {/*
            축 점수는 서버가 주지 않아 원시 지표로 되계산한 값이다.
            가중치를 함께 적어 두면 "왜 이 총점인지"가 표만 보고도 읽힌다.
          */}
          <ul className={styles.axes}>
            {AXES.map((axis, index) => (
              <li key={axis}>
                <div className={styles.axisHead}>
                  <span className={styles.axisName}>{AXIS_LABEL[axis]}</span>
                  <span className={styles.axisWeight}>
                    비중 {Math.round(info.weights[axis] * 100)}%
                  </span>
                  <span className={styles.axisScore}>
                    <CountUp value={axisScores[axis]} />
                  </span>
                </div>
                <div className={styles.bar}>
                  <div
                    className={styles.barFill}
                    style={{
                      /*
                       * 시작값이 '0%'다. 숫자 0이면 React가 '0px'로 그리는데 px→%는
                       * 브라우저가 중간값을 못 만들어 전환이 통째로 건너뛴다.
                       */
                      width: grown ? `${axisScores[axis]}%` : '0%',
                      /* 위에서부터 차례로 자란다. 넷이 한꺼번에 뛰면 그냥 '나타남'이 된다 */
                      transitionDelay: `${index * 90}ms`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/*
          위 4축에 붙은 '비중 %'가 왜 그 값인지를 바로 아래에서 설명한다.
          비중은 전략마다 서버에 정해져 있는 값이다. 여기에 성향 이름을 끌어오면
          "이 전략을 골랐으니 당신은 ○○형"으로 읽히므로 전략만 말한다.
        */}
        <ul className={styles.notes}>
          <li>
            <b>{info.strategyName}</b>은 <b>{info.focusMetrics}</b>를 특히
            눈여겨봐요.
            <span className={styles.noteBody}>
              적합도를 매길 때 {AXIS_LABEL.stable}에{' '}
              {Math.round(info.weights.stable * 100)}%, {AXIS_LABEL.profit}에{' '}
              {Math.round(info.weights.profit * 100)}% 비중을 둡니다.
            </span>
          </li>
        </ul>

        {/*
          표 대신 낱장 카드로 편다. 표는 가로로 길어 좁은 화면에서 밀어 봐야 하고,
          칸이 좁아 해설을 넣을 자리가 없다. 카드는 화면 폭에 따라 3·2·1열로 접힌다.
        */}
        <ul className={styles.metrics}>
          {metrics.map((metric) => (
            <li key={metric.label} className={styles.metric}>
              <span className={styles.metricLabel}>{metric.label}</span>
              <strong
                className={
                  metric.tone === undefined
                    ? styles.metricValue
                    : `${styles.metricValue} ${styles[metric.tone]}`
                }
              >
                {metric.value}
              </strong>
              <span className={styles.metricDesc}>{metric.desc}</span>
            </li>
          ))}
        </ul>

        {/*
          거래가 한 번도 안 걸리면 손익이 0이라 낙폭도 변동성도 0이 되고,
          안정성 점수만 100점으로 치솟는다. 점수만 보면 '아주 안정적인 종목'처럼 읽히지만
          실제로는 이 전략이 이 종목에서 신호를 한 번도 못 잡은 것이다. 먼저 알린다.
        */}
        {result.growth.positionCount === 0 && (
          <p className={styles.warn}>
            이 기간에는 매매 신호가 한 번도 나오지 않았어요. 손익이 없어 안정성
            점수가 높게 잡히니, 적합도보다 <b>거래횟수 0회</b>를 먼저 봐주세요.
          </p>
        )}

      </div>

      {/*
        카드마다 맡은 말이 하나씩이다.
        ① 결론(내 성향 ↔ 종목 성향) ② 고른 전략의 성적 ③ 왜 그 성향으로 판정됐는가.
        한 카드에 다 넣으면 스크롤만 길고 무엇을 먼저 봐야 할지 알 수 없다.
      */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          {withTopicParticle(stockName)} 어떤 성향에 맞나요?
          {/*
            순서가 고정이라는 걸 말해 준다. 점수 순으로 줄 세우던 때는 필요 없던 말인데,
            자리를 고정하고 나면 "왜 이 순서지"가 먼저 걸린다. 위아래가 무엇을 뜻하는지
            알려주면 막대 모양만으로 종목의 성격이 읽힌다.
          */}
          <span className={styles.cardNote}>
            1년 기준 · 위쪽이 순한 성향, 아래로 갈수록 센 성향
          </span>
        </h3>

        <ul className={styles.rankList}>
          {ranking.map((item, index) => {
            const rankInfo = findInvestType(item.investType)
            if (rankInfo === null) return null
            /* 자리가 아니라 점수로 1위를 가린다. 목록 순서는 늘 안정형부터다 */
            const isTop = item.investType === best.investType

            return (
              <li key={item.investType} className={styles.rank}>
                <span className={styles.rankName}>
                  {isTop && <b className={styles.crown}>최고</b>}
                  {rankInfo.personality}
                </span>
                <div className={styles.bar}>
                  <div
                    className={isTop ? styles.barFillTop : styles.barFill}
                    style={{
                      /* 위와 같은 이유로 '0%'다 (0px → % 는 전환되지 않는다) */
                      width: grown ? `${item.score}%` : '0%',
                      /* 위에서부터 차례로. 4축이 다 자란 뒤에 이어서 시작한다 */
                      transitionDelay: `${360 + index * 70}ms`,
                    }}
                  />
                </div>
                <span className={styles.rankScore}>
                  <CountUp value={item.score} digits={1} />
                </span>
              </li>
            )
          })}
        </ul>

        <p className={styles.meta}>
          {preset.startDate} ~ {preset.endDate} 일봉 기준 · 매일 새벽 4시에 다시
          계산돼요
        </p>
      </div>
    </section>
  )
}

/**
 * 0에서 목표값까지 올라가는 숫자 하나.
 * 컴포넌트로 만든 건 반복문 안에서 훅을 부를 수 없어서다 — map 안에서 직접 부르면
 * 그리는 개수에 따라 훅 순서가 달라져 React가 상태를 뒤섞는다.
 */
function CountUp({ value, digits = 0 }: { value: number; digits?: number }) {
  return <>{useCountUp(value).toFixed(digits)}</>
}

/* -------------------------------------------------------------------- *
 * 오른쪽 가이드 — 읽는 글이 아니라 고르는 도구다
 * -------------------------------------------------------------------- */

/**
 * 읽는 곳이다. 여기서는 아무것도 고를 수 없다.
 * 예전에는 누를 수 있는 전략 목록이 있었지만, 왼쪽 카드가 이름과 설명을 함께 보여주게
 * 되면서 고르는 일은 그쪽으로 모았다. 남은 것은 백테스트가 뭔지, 고른 전략이 언제
 * 사고 파는지, 점수가 어떻게 나오는지 셋이다.
 */
function BacktestGuide() {
  return (
    <aside className={styles.guide}>
      <h2 className={styles.guideTitle}>
        JUBY의
        <br />
        백테스트 가이드
      </h2>

      <div className={styles.guideCard}>
        {/*
          "미래 주가를 예측하는 것"이라고 쓰지 않는다.
          백테스트는 과거에 대고 **확인**하는 일이지 앞을 맞히는 일이 아니다.
          예측이라고 적으면 결과를 예언으로 읽게 되는데, 이 화면은 초보자가 보는
          곳이라 그 오해가 그대로 투자 판단이 된다. 대신 "무엇에 쓰는지"를 적어
          왜 보는지는 알 수 있게 한다.
        */}
        <section className={styles.guideSection}>
          <h3 className={styles.guideHeading}>백테스트가 뭔가요?</h3>
          <p className={styles.guideBody}>
            투자 전략을 과거 주가에 그대로 적용해 <b>가상으로</b> 사고팔아 보는
            거예요. 실제 돈 없이 <b>그 전략이 이 종목에서 통했는지</b> 확인할 수
            있어요. 앞으로도 그럴 거라는 뜻은 아니지만, 어떤 전략이 이 종목과
            맞는지 가늠하는 데 씁니다.
          </p>
        </section>

        {/*
          채점 기준을 전략 설명보다 앞에 둔다.
          전략을 고르기 전에 "무엇을 잘해야 점수가 오르는지"를 알아야, 아래 전략들이
          서로 어떻게 다른지가 비로소 읽힌다. 순서를 뒤집으면 매수·매도 조건만 보고
          고른 뒤에야 채점 기준을 알게 된다.
        */}
        <section className={styles.guideSection}>
          <h3 className={styles.guideHeading}>점수는 어떻게 나오나요?</h3>
          <p className={styles.guideBody}>
            네 가지를 각각 100점으로 매긴 뒤, 전략마다 다른 비중으로 합쳐
            <b> 적합도</b>를 냅니다.
          </p>
          <dl className={styles.axisGuide}>
            <dt>안정성</dt>
            <dd>얼마나 안 깨졌나 (최대낙폭·변동성)</dd>
            <dt>수익성</dt>
            <dd>얼마나 벌었나 (누적·연평균 수익률)</dd>
            <dt>효율성</dt>
            <dd>위험 대비 얼마나 벌었나 (샤프비율)</dd>
            <dt>성장성</dt>
            <dd>지금 뜨고 있나 (모멘텀·거래량)</dd>
          </dl>
        </section>

      </div>
    </aside>
  )
}

