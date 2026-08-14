import type { BacktestPeriod, QuantScoring } from '../types/backtest'
import type { PersonalityType } from '../types/personality'

/**
 * 백테스트 도메인 규칙. **전부 JUBY-BE 소스에서 그대로 옮긴 값이다.**
 *
 * 서버에도 `GET /api/backtest/preset/options`가 있어 성향별 기간 목록을 내려주지만,
 * 화면이 열리자마자 선택지를 그려야 해서 여기 사본을 둔다.
 * 백엔드가 전략이나 기간 정책을 바꾸면 이 파일도 같이 고쳐야 한다.
 */

/** 기간 프리셋. 배열 순서 = 백엔드 enum 선언 순서 = 짧은 기간부터 */
export const PERIODS: {
  period: BacktestPeriod
  label: string
  months: number
}[] = [
  { period: 'ONE_MONTH', label: '1개월', months: 1 },
  { period: 'THREE_MONTHS', label: '3개월', months: 3 },
  { period: 'SIX_MONTHS', label: '6개월', months: 6 },
  { period: 'ONE_YEAR', label: '1년', months: 12 },
]

/** 채점 4축. 화면에서 순서대로 그린다 */
export const AXES = ['stable', 'profit', 'effect', 'growth'] as const
export type Axis = (typeof AXES)[number]

export const AXIS_LABEL: Record<Axis, string> = {
  stable: '안정성',
  profit: '수익성',
  effect: '효율성',
  growth: '성장성',
}

interface InvestTypeInfo {
  /** 백엔드에 보내는 값(1~5). 커질수록 공격적이다 */
  investType: number
  personality: PersonalityType
  strategyName: string
  /**
   * 백테스트 실행(POST /api/backtest)에 보낼 전략 식별자.
   *
   * 위 strategyName은 사람에게 보여주는 이름이고, 이건 백엔드의 스프링 빈 이름이다
   * (`@Component` 클래스명 첫 글자를 내린 것 — SmaStrategy → smaStrategy).
   * 서버가 `Map<String, BacktestStrategy>`에서 이 키로 전략을 찾는다.
   *
   * **null이면 실행을 부르지 않는다.** 백엔드 전략 클래스가 넷뿐인데 화면 성향은
   * 다섯이라 두 개는 짝이 없다. 없는 이름을 지어 보내면 서버가 무엇을 돌릴지 모른다.
   * (프리셋 조회는 영향이 없다 — 그쪽은 새벽 배치가 미리 계산해 둔 값을 읽는다.)
   */
  strategyKey: string | null
  /** 가이드에 적는 한 줄 설명 */
  strategySummary: string
  /** 매수·매도 조건. 백엔드 전략 클래스의 Rule을 사람 말로 옮긴 것 */
  entryRule: string
  exitRule: string
  /**
   * 이 성향이 고를 수 있는 가장 짧은 기간.
   * 지표가 쓰는 봉 수(RSI 14, 볼린저 20, SMA 60, MACD 26, 돌파 20)를 감당하려면
   * 이만큼은 있어야 한다. 더 짧게 요청하면 서버가 400을 준다.
   */
  minPeriod: BacktestPeriod
  /** 4축을 최종 점수로 합칠 때 쓰는 비중. 합이 1이다 */
  weights: Record<Axis, number>
  /** 이 성향이 특히 들여다보는 지표(설명 문구에 쓴다) */
  focusMetrics: string
}

/**
 * 성향 → 전략 → 기간 제한 → 가중치.
 *
 * **프리셋 조회에서는 전략이 사용자가 고르는 값이 아니다.** 성향 번호 하나로 전략까지
 * 정해지므로 둘은 1:1이고, 화면에서 따로 고르는 것처럼 보여도 서버에 나가는 값은
 * investType 하나뿐이다.
 *
 * 백테스트 실행(POST)은 다르다. 그쪽은 성향 번호가 아니라 전략 이름을 직접 받으므로
 * 아래 strategyKey가 필요하다.
 */
export const INVEST_TYPES: InvestTypeInfo[] = [
  {
    investType: 1,
    personality: '안정형',
    strategyName: 'RSI 역추세 전략',
    strategyKey: 'rsiReversionStrategy',
    strategySummary:
      '너무 많이 팔려 눌린 종목이 제자리로 돌아오는 힘을 노리는 전략이에요.',
    entryRule: 'RSI가 40을 위로 뚫을 때 (과매도에서 회복하기 시작할 때)',
    exitRule: 'RSI가 70을 아래로 뚫을 때 (과열이 식기 시작할 때)',
    minPeriod: 'ONE_MONTH',
    weights: { stable: 0.4, profit: 0.15, effect: 0.3, growth: 0.15 },
    focusMetrics: 'MDD와 표준편차',
  },
  {
    investType: 2,
    personality: '안정추구형',
    strategyName: '볼린저 밴드 돌파 전략',
    strategyKey: 'bollingerBandStrategy',
    strategySummary:
      '주가가 평소 움직이던 띠를 벗어나는 순간을 신호로 삼는 전략이에요.',
    entryRule: '종가가 밴드 상단을 위로 뚫을 때',
    exitRule: '종가가 밴드 하단을 아래로 뚫을 때',
    minPeriod: 'THREE_MONTHS',
    weights: { stable: 0.35, profit: 0.2, effect: 0.3, growth: 0.15 },
    focusMetrics: 'MDD와 샤프비율',
  },
  {
    investType: 3,
    personality: '위험중립형',
    strategyName: '이동평균 교차 전략',
    strategyKey: 'smaStrategy',
    strategySummary:
      '단기 이동평균선이 장기선을 뚫고 올라갈 때 사고, 내려갈 때 파는 전략이에요.',
    entryRule: '20일선이 60일선을 위로 뚫을 때',
    exitRule: '20일선이 60일선을 아래로 뚫을 때',
    minPeriod: 'SIX_MONTHS',
    weights: { stable: 0.25, profit: 0.25, effect: 0.25, growth: 0.25 },
    focusMetrics: '샤프비율과 연평균수익률',
  },
  {
    investType: 4,
    personality: '적극투자형',
    strategyName: 'MACD 추세추종 전략',
    /* 백엔드에 MACD 전략 클래스가 없다. emaStrategy가 남아 있지만 같은 것이라는 근거가 없다 */
    strategyKey: null,
    strategySummary:
      '단기·장기 이동평균의 차이로 추세의 강도와 방향을 함께 읽는 전략이에요.',
    entryRule: 'MACD선이 시그널선을 위로 뚫을 때',
    exitRule: 'MACD선이 시그널선을 아래로 뚫을 때',
    minPeriod: 'THREE_MONTHS',
    weights: { stable: 0.15, profit: 0.3, effect: 0.25, growth: 0.3 },
    focusMetrics: '연평균수익률과 샤프비율',
  },
  {
    investType: 5,
    personality: '공격투자형',
    strategyName: '돌파 전략',
    /* 백엔드에 돌파 전략 클래스가 없다 */
    strategyKey: null,
    strategySummary:
      '거래량이 함께 터지며 신고가를 뚫는 순간에 올라타는 전략이에요.',
    entryRule: '최근 20일 최고가를 뚫고, 거래량이 20일 평균의 1.5배 이상일 때',
    exitRule: '돌파 기준선이 무너지고, 매수가에서 ATR의 2배만큼 밀렸을 때',
    minPeriod: 'THREE_MONTHS',
    weights: { stable: 0.1, profit: 0.3, effect: 0.2, growth: 0.4 },
    focusMetrics: '누적수익률과 샤프비율',
  },
]

export function findInvestType(investType: number): InvestTypeInfo | null {
  return INVEST_TYPES.find((item) => item.investType === investType) ?? null
}

export function findByPersonality(
  personality: PersonalityType,
): InvestTypeInfo | null {
  return INVEST_TYPES.find((item) => item.personality === personality) ?? null
}

/**
 * 이 성향이 고를 수 있는 기간만 남긴다.
 * 백엔드가 enum ordinal로 비교하므로 배열 인덱스로 같은 판정을 한다.
 */
export function supportedPeriods(investType: number): BacktestPeriod[] {
  const info = findInvestType(investType)
  if (info === null) return []

  const minIndex = PERIODS.findIndex((item) => item.period === info.minPeriod)
  return PERIODS.slice(minIndex).map((item) => item.period)
}

/**
 * 기간을 사람이 읽는 말로. 필요할 때만 개월 수를 괄호에 덧붙인다.
 *
 * 늘 붙이던 것을 고쳤다. '1년 (12개월)'은 12라는 숫자를 알려 주지만
 * **'3개월 (3개월)'은 같은 말을 두 번 하는 것**이라 읽는 사람이 잠깐 멈칫한다.
 * 이름이 이미 개월 수와 같으면 괄호를 생략한다.
 */
export function periodLabel(period: BacktestPeriod): string {
  const found = PERIODS.find((item) => item.period === period)
  if (found === undefined) return ''

  return found.label === `${found.months}개월`
    ? found.label
    : `${found.label} (${found.months}개월)`
}

/**
 * 적합도 점수를 말로 옮긴다.
 *
 * 백엔드는 숫자만 주고 등급을 나누지 않는다. 화면에서 "적합/보통/부적합"을
 * 말하려면 어딘가에서 선을 그어야 해서 여기서 긋는다.
 * 서버가 등급을 내려주기 시작하면 이 함수는 버린다.
 */
export function scoreVerdict(score: number): {
  /** 문장 안에 넣는 꼴: "~에 적합한 종목이에요" */
  label: string
  /** 홀로 쓰는 꼴: 점수 밑에 붙이는 짧은 말 */
  short: string
  tone: 'good' | 'normal' | 'bad'
} {
  if (score >= 70) return { label: '적합한', short: '잘 맞아요', tone: 'good' }
  if (score >= 50)
    return { label: '무난한', short: '무난해요', tone: 'normal' }
  return { label: '맞지 않는', short: '잘 안 맞아요', tone: 'bad' }
}

/** 소수 비율(0.1856)을 백분율 문자열(18.56%)로 */
export function toPercent(ratio: number, digits = 2): string {
  return `${(ratio * 100).toFixed(digits)}%`
}

/* ------------------------------------------------------------------ *
 * 축별 점수 되계산
 *
 * ⚠️ 여기부터는 백엔드 ScoreCalculator를 그대로 베낀 코드다. 원래는 없어야 한다.
 *
 * 백엔드는 안정성·수익성·효율성·성장성 점수를 계산해 놓고 **로그로만 찍고 버린다**
 * (AnalysisCriterionConverter). 응답 DTO에는 finalScore 하나만 담긴다.
 * 그런데 "왜 이 점수인지"를 화면에서 보여주려면 축별 점수가 있어야 해서,
 * 서버가 함께 주는 원시 지표로 같은 계산을 다시 한다.
 *
 * **백엔드 응답에 축별 점수가 추가되면 이 구간은 통째로 지운다.**
 * 그때까지는 정규화 기준값(0.05, 0.4 같은 숫자)이 양쪽에 흩어져 있으므로,
 * 백엔드가 기준을 바꾸면 화면 점수만 조용히 어긋난다. 오래 둘 코드가 아니다.
 * ------------------------------------------------------------------ */

/** 클수록 좋은 지표: min이 0점, max가 100점 */
function normalizePositive(value: number, min: number, max: number): number {
  if (max === min) return 0
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

/** 작을수록 좋은 지표: best가 100점, worst가 0점 */
function normalizeNegative(value: number, best: number, worst: number): number {
  if (worst === best) return 0
  return Math.min(100, Math.max(0, ((worst - value) / (worst - best)) * 100))
}

export function calculateAxisScores(
  result: QuantScoring,
): Record<Axis, number> {
  const stable =
    normalizeNegative(result.stable.mdd, 0.05, 0.4) * 0.5 +
    normalizeNegative(result.stable.volatility, 0.05, 0.4) * 0.25 +
    normalizeNegative(result.stable.dVolatility, 0.03, 0.3) * 0.25

  const profit =
    normalizePositive(result.profit.totalReturn, 0, 0.1) * 0.1 +
    normalizePositive(result.profit.annualReturn, 0, 0.5) * 0.6 +
    normalizePositive(result.profit.avgTradeReturn, 0, 0.1) * 0.3

  const effect =
    normalizePositive(result.effect.sharpeRatio, 0, 2) * 0.5 +
    normalizePositive(result.effect.sortinoRatio, 0, 3) * 0.25 +
    normalizePositive(result.effect.calmarRatio, 0, 3) * 0.25

  const growth =
    normalizePositive(result.growth.momentumRatio, -0.2, 0.2) * 0.4 +
    normalizePositive(result.growth.volGrowthRatio, 0, 0.5) * 0.3 +
    normalizePositive(result.growth.positionCount, 0, 20) * 0.3

  return {
    stable: Math.round(stable * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    effect: Math.round(effect * 100) / 100,
    growth: Math.round(growth * 100) / 100,
  }
}
