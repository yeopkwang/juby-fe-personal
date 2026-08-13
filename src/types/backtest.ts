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
 *
 * 요청 시점에 계산하는 게 아니라 매일 새벽 4시 배치가 미리 채워 둔 값을 읽어온다.
 * 그래서 startDate/endDate가 요청한 날짜가 아니라 **계산에 실제로 쓰인 날짜**이고,
 * updatedAt으로 언제 계산된 값인지 알려준다.
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

/* ------------------------------------------------------------------ *
 * POST /api/backtest — 지금 이 자리에서 돌리는 백테스트
 *
 * 위의 프리셋과 전혀 다른 것이다. 프리셋은 새벽 배치가 미리 계산해 둔 값을 읽어오고,
 * 이쪽은 **고른 조건으로 서버가 그 자리에서 계산한다.** 그래서
 *   - 요청이 성향 번호가 아니라 전략 이름과 날짜 범위다
 *   - 응답에 4축 점수가 없다. 대신 원시 지표 여섯 개가 온다
 *   - 로그인이 필요하다 (Authorization 헤더)
 * ------------------------------------------------------------------ */

/** 요청 본문. 날짜는 YYYY-MM-DD */
export interface BacktestRunRequest {
  stockCode: string
  /**
   * 백엔드 전략 빈 이름. 사람에게 보여주는 '이동평균 교차 전략'이 아니라
   * `smaStrategy` 같은 식별자다. utils/backtest.ts의 `strategyKey` 참고.
   */
  strategyName: string
  startDate: string
  endDate: string
}

/**
 * 응답 result.
 *
 * **단위는 ta4j가 정한다.** 백엔드가 계산을 직접 하지 않고 ta4j 0.22.3의 Criterion을
 * 그대로 부르기 때문에(`AnalysisCriterionConverter`), 숫자의 뜻도 그쪽 규약을 따른다.
 * 프리셋 쪽 소수 표기(0.1856 = 18.56%)와 **다르므로 섞어 쓰면 안 된다.**
 *
 * | 필드 | 무엇으로 오나 |
 * | --- | --- |
 * | `totalReturn` | **배수.** 1.0이 본전, 2.04면 +104% (NetReturnCriterion 기본값이 MULTIPLICATIVE) |
 * | `maxDrawdown` | 비율. 0.313 = 31.3% (고점 대비 낙폭이라 원래 비율이다) |
 * | `sharpeRatio` `stdDeviation` | 단위 없는 수. 그대로 쓴다 |
 */
export interface BacktestRun {
  /** 내 투자성향. 로그인 사용자의 저장된 값 */
  investPersonality: string | null
  /** 이 종목에 어울린다고 서버가 판단한 성향 */
  recommendPersonality: string | null
  stockCode: string
  /** 사람이 읽는 이름으로 돌아온다 ('SMA 이동평균교차 전략') */
  strategyName: string
  /** 체결된 매수~매도 한 쌍의 개수 */
  positionCount: number
  totalReturn: number
  /**
   * 연평균 수익률. **아직 계산되지 않아 누적 수익률과 같은 값이 온다.**
   * 백엔드 `AnalysisCriterionConverter`가 `List.of(totalReturn, totalReturn, ...)`으로
   * 같은 값을 두 번 담는다(`// 연평균 수익률 추후 추가` 주석이 그대로 있다).
   * 그래서 화면은 누적과 다를 때만 이 값을 보여준다.
   */
  annualizedReturn: number | null
  sharpeRatio: number
  /** 수익률 표준편차 */
  stdDeviation: number
  /** 최대낙폭 */
  maxDrawdown: number
}
