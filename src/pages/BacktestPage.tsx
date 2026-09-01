import { useEffect, useMemo, useRef, useState } from 'react'
import { STOCK_LIST } from '../api/stockList'
import type { StockInfo } from '../types/stock'
import type { BacktestPeriod, BacktestPreset } from '../types/backtest'
import type { PersonalityType } from '../types/personality'
import { PERSONALITY_INFO } from '../utils/personality'
import {
  AXES,
  AXIS_LABEL,
  INVEST_TYPES,
  PERIODS,
  calculateAxisScores,
  findByPersonality,
  findInvestType,
  periodLabel,
  scoreVerdict,
  supportedPeriods,
  toPercent,
} from '../utils/backtest'
import { buildSamplePreset } from '../utils/backtestSample'
import styles from './BacktestPage.module.css'

/**
 * 🧪 원래는 GET /api/members/me/personality 로 받는 값이다.
 *
 * 백엔드 호출이 막혀 있어 고정해 둔다. 붙일 때 세 가지를 함께 다뤄야 한다.
 *   1. 이 API는 로그인이 필요하다 (@AuthenticationPrincipal)
 *   2. 토큰 없이 부르면 401이 아니라 **500**이 난다 (서버가 principal에서 id를 바로 꺼낸다)
 *   3. 로그인해도 성향테스트를 안 했으면 비어 있다 (personality 테이블도 아직 비어 있다)
 * 셋 다 "성향 없음"으로 뭉뚱그려 null로 두고, 화면은 성향테스트로 안내한다.
 */
const SAVED_PERSONALITY: PersonalityType | null = '안정형'

/**
 * 종목의 성향을 가릴 때 쓰는 기준 기간.
 *
 * 전략 5개의 점수를 견주려면 **같은 기간**이어야 한다. 그런데 전략마다 고를 수 있는
 * 최소 기간이 달라서(이동평균 교차는 6개월부터), 다섯 전략이 모두 갖춘 기간으로 고정한다.
 * 사용자가 3개월을 골라도 종목 성향만은 늘 이 기간으로 비교한다.
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
const PERSONALITY_TEST_URL = '/personality.html'

export default function BacktestPage() {
  const [query, setQuery] = useState('')
  const [stock, setStock] = useState<StockInfo | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  /*
   * 성향은 더 이상 고르는 값이 아니다. 성향테스트 결과에 맞는 전략을 미리 골라 두고,
   * 사용자는 전략만 바꾼다. 서버로 나가는 값은 어차피 investType 하나뿐이라
   * 전략을 고르는 것이 곧 성향을 고르는 것과 같다.
   */
  const recommended =
    SAVED_PERSONALITY === null ? null : findByPersonality(SAVED_PERSONALITY)

  const [investType, setInvestType] = useState<number | null>(
    recommended?.investType ?? null,
  )
  const [period, setPeriod] = useState<BacktestPeriod | null>(null)
  const [preset, setPreset] = useState<BacktestPreset | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const selected = investType === null ? null : findInvestType(investType)
  const periodChoices = investType === null ? [] : supportedPeriods(investType)
  const canRun = stock !== null && investType !== null && period !== null

  const matches = useMemo(() => {
    const keyword = query.trim()
    if (keyword === '') return []
    // 고른 종목의 이름이 그대로 적혀 있으면 다시 펼칠 이유가 없다
    if (stock !== null && keyword === stock.stockName) return []

    return STOCK_LIST.filter(
      (item) =>
        item.stockName.includes(keyword) || item.stockCode.startsWith(keyword),
    ).slice(0, MAX_MATCHES)
  }, [query, stock])

  /**
   * 종목의 투자성향 = 다섯 전략으로 각각 돌려 적합도가 가장 높게 나온 전략의 성향.
   *
   * 서버에는 "이 종목은 무슨 성향" 같은 API가 없다. 전략별 점수를 모아 프론트가 고른다.
   * 붙일 때는 GET /api/backtest/preset 을 investType만 바꿔 다섯 번 부른다(전부 DB 조회다).
   */
  const ranking = useMemo(() => {
    if (stock === null) return []

    return INVEST_TYPES.map((item) => ({
      investType: item.investType,
      score: buildSamplePreset(stock.stockCode, item.investType, COMPARE_PERIOD)
        .result.finalScore,
    })).sort((left, right) => right.score - left.score)
  }, [stock])

  /*
   * 조건을 건드리면 이전 결과는 더 이상 그 조건의 결과가 아니다.
   * 남겨 두면 화면의 입력과 결과가 어긋난 채로 보인다.
   */
  function clearResult() {
    setPreset(null)
  }

  function handleQueryChange(value: string) {
    setQuery(value)
    setStock(null)
    setIsSearchOpen(true)
    clearResult()
  }

  function selectStock(item: StockInfo) {
    setStock(item)
    setQuery(item.stockName)
    setIsSearchOpen(false)
    clearResult()
  }

  /**
   * 전략마다 고를 수 있는 기간이 달라서, 전략을 바꾸면 못 쓰게 된 기간을 놓아 준다.
   * 안 놓아 주면 화면에는 3개월이 적혀 있는데 서버는 400을 주는 상태가 된다.
   */
  function changeStrategy(next: number | null) {
    setInvestType(next)
    if (next !== null && period !== null) {
      if (!supportedPeriods(next).includes(period)) {
        setPeriod(null)
      }
    }
    clearResult()
  }

  function handleSubmit() {
    if (stock === null || investType === null || period === null) return
    setPreset(buildSamplePreset(stock.stockCode, investType, period))
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
          성향은 고르는 칸이 아니라 '이미 정해진 나의 정보'다.
          입력 칸에서 빼고 맨 위에 사실로 적어 둔다.
        */}
        <div className={styles.myBanner}>
          {SAVED_PERSONALITY === null ? (
            <>
              <p className={styles.myText}>
                투자성향테스트를 아직 안 하셨어요. 먼저 하면 나에게 맞는 전략을
                자동으로 골라드려요.
              </p>
              <a className={styles.myAction} href={PERSONALITY_TEST_URL}>
                테스트하러 가기
              </a>
            </>
          ) : (
            <>
              <p className={styles.myText}>
                내 투자성향은 <b>{SAVED_PERSONALITY}</b>이에요.
                {recommended !== null && (
                  <>
                    {' '}
                    여기에 맞는 <b>{recommended.strategyName}</b>을 골라 뒀어요.
                  </>
                )}
              </p>
              <a className={styles.myAction} href={PERSONALITY_TEST_URL}>
                다시 테스트
              </a>
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
                  onChange={(event) => handleQueryChange(event.target.value)}
                  onFocus={() => setIsSearchOpen(true)}
                  onBlur={() => setIsSearchOpen(false)}
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
                  className={styles.matches}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  {matches.map((item) => (
                    <li key={item.stockCode}>
                      <button
                        type="button"
                        className={styles.match}
                        onClick={() => selectStock(item)}
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
          <div className={styles.field}>
            <label className={styles.label} htmlFor="backtest-strategy">
              <span className={styles.step}>2</span>
              투자전략 선택
            </label>

            <div className={styles.control}>
              <select
                id="backtest-strategy"
                className={styles.select}
                value={investType ?? ''}
                onChange={(event) =>
                  changeStrategy(
                    event.target.value === ''
                      ? null
                      : Number(event.target.value),
                  )
                }
              >
                <option value="">투자전략을 선택해주세요.</option>
                {INVEST_TYPES.map((item) => (
                  <option key={item.investType} value={item.investType}>
                    {item.strategyName}
                  </option>
                ))}
              </select>

              {investType !== null && recommended?.investType !== investType && (
                <button
                  type="button"
                  className={styles.reset}
                  onClick={() => changeStrategy(recommended?.investType ?? null)}
                >
                  재설정
                </button>
              )}
            </div>

            {/*
              좁은 화면에서는 가이드가 오른쪽이 아니라 아래로 내려간다.
              방향을 말하면 절반은 틀린 말이 되므로 위치를 가리키지 않는다.
              고른 전략이 무엇인지도 여기서 한 줄로 되짚어 준다 —
              가이드까지 눈을 옮기지 않아도 무엇을 골랐는지 알 수 있어야 한다.
            */}
            <p className={styles.hint}>
              {selected === null
                ? '백테스트 가이드에서 전략을 눌러 골라도 돼요.'
                : selected.strategySummary}
            </p>
          </div>

          {/* 투자기간 선택 ------------------------------------------------ */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="backtest-period">
              <span className={styles.step}>3</span>
              투자기간 선택
            </label>

            <div className={styles.control}>
              <select
                id="backtest-period"
                className={styles.select}
                value={period ?? ''}
                disabled={investType === null}
                onChange={(event) => {
                  setPeriod(
                    event.target.value === ''
                      ? null
                      : (event.target.value as BacktestPeriod),
                  )
                  clearResult()
                }}
              >
                <option value="">
                  {investType === null
                    ? '투자전략을 먼저 선택해주세요.'
                    : '투자기간을 선택해주세요.'}
                </option>
                {PERIODS.filter((item) =>
                  periodChoices.includes(item.period),
                ).map((item) => (
                  <option key={item.period} value={item.period}>
                    {periodLabel(item.period)}
                  </option>
                ))}
              </select>
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
              disabled={!canRun}
              onClick={handleSubmit}
            >
              백테스트 시작하기
            </button>

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
              onRetry={clearResult}
            />
          )}
        </div>
      </div>

      <BacktestGuide investType={investType} onSelect={changeStrategy} />
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
  onRetry: () => void
}

function BacktestResult({
  preset,
  stockName,
  ranking,
  onRetry,
}: ResultProps) {
  const info = findInvestType(preset.investType)
  const best = ranking[0]
  const bestInfo = best === undefined ? null : findInvestType(best.investType)
  if (info === null || bestInfo === null || best === undefined) return null

  const { result } = preset
  const axisScores = calculateAxisScores(result)
  const verdict = scoreVerdict(result.finalScore)
  /** 종목이 나와 같은 성향으로 판정됐는가 */
  const isSame = SAVED_PERSONALITY === bestInfo.personality
  /** 내 성향에 딸린 전략을 그대로 돌렸는가 (다른 전략으로 바꿔 볼 수 있다) */
  const usedOwnStrategy = SAVED_PERSONALITY === info.personality

  /*
   * 지표를 표로 늘어놓으면 숫자는 보이는데 뜻이 안 보인다. JUBY는 초보자용이라
   * 용어 자체가 벽이다("샤프비율 1.69"를 읽고 좋은지 나쁜지 알 수 있는 사람은 적다).
   * 그래서 값마다 한 줄 해설을 붙이고, 어려운 말은 쉬운 이름을 앞세우고 원래 용어를 괄호에 둔다.
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
        읽는 사람이 가장 먼저 알아야 할 한 줄.
        "나는 이런 사람 → 이 전략으로 봤더니 → 이 종목은 이런 사람에게 맞더라"
        세 마디를 순서대로 잇는다.
      */}
      <div className={styles.compare}>
        <p className={styles.story}>
          {SAVED_PERSONALITY === null ? (
            <>
              <b>{info.strategyName}</b>으로 분석한 결과,{' '}
              {withTopicParticle(stockName)} <b>{bestInfo.personality}</b>에게
              가장 잘 맞는 종목이에요.
            </>
          ) : (
            <>
              {/*
                내 성향에 딸린 전략을 그대로 썼는지, 다른 전략을 골랐는지에 따라
                문장이 달라야 한다. 다른 걸 골랐는데 "나에게 맞는 전략"이라고 하면 거짓말이다.
              */}
              나는 <b>{SAVED_PERSONALITY}</b>,{' '}
              {usedOwnStrategy ? (
                <>
                  여기에 맞는 <b>{info.strategyName}</b>으로 분석했어요.
                </>
              ) : (
                <>
                  하지만 <b>{info.personality}</b>용인{' '}
                  <b>{info.strategyName}</b>으로 분석했어요.
                </>
              )}
              <br />그 결과 {withTopicParticle(stockName)}{' '}
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
              {SAVED_PERSONALITY ?? '아직 없어요'}
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

        {SAVED_PERSONALITY !== null && !isSame && (
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
              {result.finalScore.toFixed(1)}
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
            {AXES.map((axis) => (
              <li key={axis}>
                <div className={styles.axisHead}>
                  <span className={styles.axisName}>{AXIS_LABEL[axis]}</span>
                  <span className={styles.axisWeight}>
                    비중 {Math.round(info.weights[axis] * 100)}%
                  </span>
                  <span className={styles.axisScore}>
                    {axisScores[axis].toFixed(0)}
                  </span>
                </div>
                <div className={styles.bar}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${axisScores[axis]}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* 위 4축에 붙은 '비중 %'가 왜 그 값인지를 바로 아래에서 설명한다 */}
        <ul className={styles.notes}>
          <li>
            <b>{info.personality}</b>은 이런 스타일이에요.
            <span className={styles.noteBody}>
              {PERSONALITY_INFO[info.personality].description}
            </span>
          </li>
          <li>
            그래서 <b>{info.focusMetrics}</b>를 특히 눈여겨봐요.
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
          <span className={styles.cardNote}>1년 기준으로 다섯 전략을 비교</span>
        </h3>

        <ul className={styles.rankList}>
          {ranking.map((item, index) => {
            const rankInfo = findInvestType(item.investType)
            if (rankInfo === null) return null

            return (
              <li key={item.investType} className={styles.rank}>
                <span className={styles.rankName}>
                  {index === 0 && <b className={styles.crown}>최고</b>}
                  {rankInfo.personality}
                </span>
                <div className={styles.bar}>
                  <div
                    className={index === 0 ? styles.barFillTop : styles.barFill}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
                <span className={styles.rankScore}>{item.score.toFixed(1)}</span>
              </li>
            )
          })}
        </ul>

        <p className={styles.meta}>
          {preset.startDate} ~ {preset.endDate} 일봉 기준 · 매일 새벽 4시에 다시
          계산돼요
        </p>

        <p className={styles.sample}>
          아직 백엔드에 연결하지 않아 <b>화면 확인용 예시 값</b>이에요.
        </p>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------- *
 * 오른쪽 가이드 — 읽는 글이 아니라 고르는 도구다
 * -------------------------------------------------------------------- */

interface GuideProps {
  investType: number | null
  onSelect: (investType: number) => void
}

/**
 * 전략 설명을 왼쪽 선택칸과 따로 두면 아무도 안 읽는다. 목록을 그대로 **버튼**으로 만들어,
 * 설명을 읽다가 마음에 들면 그 자리에서 고르게 한다.
 *
 * 다섯 개를 모두 펼치면 글이 너무 길어 훑기 어렵다. 고른 것만 펼쳐서 매수·매도 조건까지
 * 보이고 나머지는 한 줄 요약으로 접어 둔다.
 */
function BacktestGuide({ investType, onSelect }: GuideProps) {
  return (
    <aside className={styles.guide}>
      <h2 className={styles.guideTitle}>
        JUBY의
        <br />
        백테스트 가이드
      </h2>

      <div className={styles.guideCard}>
        <section className={styles.guideSection}>
          <h3 className={styles.guideHeading}>백테스트가 뭔가요?</h3>
          <p className={styles.guideBody}>
            투자 전략을 과거 주가에 그대로 적용해 <b>가상으로</b> 사고팔아 보는
            거예요. 실제 돈 없이 수익률과 최대 손실을 미리 확인할 수 있어요.
          </p>
        </section>

        <section className={styles.guideSection}>
          <h3 className={styles.guideHeading}>
            전략 고르기
            <span className={styles.guideTip}>눌러서 선택</span>
          </h3>

          <ul className={styles.strategyList}>
            {INVEST_TYPES.map((item) => {
              const isActive = item.investType === investType
              const isRecommended =
                SAVED_PERSONALITY !== null &&
                item.personality === SAVED_PERSONALITY

              return (
                <li key={item.investType}>
                  <button
                    type="button"
                    className={
                      isActive ? styles.strategyOn : styles.strategyOff
                    }
                    aria-pressed={isActive}
                    onClick={() => onSelect(item.investType)}
                  >
                    <span className={styles.strategyTop}>
                      <RiskDots level={item.investType} />
                      {isRecommended && (
                        <span className={styles.badge}>나에게 맞음</span>
                      )}
                    </span>

                    <span className={styles.strategyName}>
                      {item.strategyName}
                    </span>
                    <span className={styles.strategyDesc}>
                      {item.strategySummary}
                    </span>

                    {/* 고른 전략만 자세히 편다 */}
                    {isActive && (
                      <span className={styles.detail}>
                        <span className={styles.detailRow}>
                          <b className={styles.buy}>매수</b>
                          {item.entryRule}
                        </span>
                        <span className={styles.detailRow}>
                          <b className={styles.sell}>매도</b>
                          {item.exitRule}
                        </span>
                        <span className={styles.detailRow}>
                          <b className={styles.term}>기간</b>
                          {periodLabel(item.minPeriod)} 이상
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

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

/** 위험도를 점 다섯 개로. 전략 번호가 곧 위험도 순서다(1 안정 → 5 공격) */
function RiskDots({ level }: { level: number }) {
  return (
    <span className={styles.dots} aria-label={`위험도 ${level}단계 (5단계 중)`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <i
          key={step}
          className={step <= level ? styles.dotOn : styles.dotOff}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}
