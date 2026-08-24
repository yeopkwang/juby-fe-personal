/**
 * 백엔드 BacktestResDto와 같은 모양이다.
 * 자바 BigDecimal은 JSON에서 그냥 숫자로 내려오므로 전부 number로 받는다.
 *
 * 비율 계열(수익률·MDD·변동성)은 백분율이 아니라 **소수**다.
 * 0.1856이 18.56%다. ScoreCalculator가 0.0~0.5 같은 범위로 정규화하는 것에서 확인했다.
 */

/** 백엔드 BacktestPeriod enum. 선언 순서가 곧 기간 길이 순서다 */
export type BacktestPeriod =
  | 'ONE_MONTH'
  | 'THREE_MONTHS'
  | 'SIX_MONTHS'
  | 'ONE_YEAR'

/** 백테스트 채점 4축. 각 축을 이루는 지표 3개씩이다 */
export interface QuantScoring {
  stockCode: string
  investType: number
  /** 성향별 가중치로 4축을 합산한 최종 적합도(0~100) */
  finalScore: number
  /** 안정성 — 얼마나 안 깨지는가 */
  stable: {
    /** 최대낙폭 */
    mdd: number
    /** 연환산 변동성 */
    volatility: number
    /** 연환산 하방 변동성 */
    dVolatility: number
  }
  /** 수익성 — 얼마나 벌었는가 */
  profit: {
    totalReturn: number
    annualReturn: number
    avgTradeReturn: number
  }
  /** 효율성 — 위험 대비 얼마나 벌었는가 */
  effect: {
    sharpeRatio: number
    sortinoRatio: number
    calmarRatio: number
  }
  /** 성장성 — 지금 뜨고 있는가 */
  growth: {
    momentumRatio: number
    volGrowthRatio: number
    /** 기간 중 체결된 매수~매도 한 쌍의 개수 */
    positionCount: number
  }
}

/**
 * GET /api/backtest/preset 의 응답.
 * 매일 새벽 4시 배치가 미리 채워 둔 값이라 startDate/endDate는 요청한 날짜가 아니라
 * 계산에 실제로 쓰인 날짜다.
 */
export interface BacktestPreset {
  stockCode: string
  investType: number
  period: BacktestPeriod
  /** YYYY-MM-DD. 다른 화면의 YYYYMMDD와 형식이 다르다 */
  startDate: string
  endDate: string
  /** ISO 날짜시각 */
  updatedAt: string
  result: QuantScoring
}
