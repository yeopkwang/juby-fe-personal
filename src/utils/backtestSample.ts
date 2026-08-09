import type { BacktestPeriod, BacktestPreset } from '../types/backtest'
import {
  AXES,
  PERIODS,
  calculateAxisScores,
  findInvestType,
} from './backtest'

/**
 * 🧪 화면 확인용 예시 결과. **백엔드에 붙이면 이 파일을 통째로 지운다.**
 *
 * 백엔드 호출이 막혀 있어(src/api/client.ts의 API_DISABLED) 실제 값을 받을 수 없다.
 * 그렇다고 빈 화면만 두면 결과 화면을 만들 수도, 남에게 보여줄 수도 없어서
 * 서버 응답과 **같은 모양**의 값을 지어낸다.
 *
 * 값은 종목·성향·기간에서 뽑은 씨앗으로 만든다. 난수를 쓰면 다시 그릴 때마다 숫자가
 * 흔들려 화면이 미덥지 않아 보이고, 하나로 고정하면 무엇을 골라도 같은 결과가 나와
 * 화면이 동작하는지 확인할 수 없다. 같은 조건이면 늘 같은 값이 나오게 한다.
 */

/** 문자열을 32비트 정수 하나로 뭉갠다(FNV-1a). 암호용이 아니라 씨앗용이다 */
function hashSeed(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** 씨앗을 조금씩 굴려 0~1 사이 값을 순서대로 뽑는다 */
function createPicker(seed: number) {
  let state = seed
  return function pick(min: number, max: number): number {
    // xorshift32 — 짧고 치우침이 적다
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return min + (state / 4294967296) * (max - min)
  }
}

/** endDate에서 months만큼 거슬러 올라간다. 백엔드 BacktestPeriod.calculateStartDate와 같다 */
function minusMonths(date: Date, months: number): Date {
  const moved = new Date(date)
  moved.setMonth(moved.getMonth() - months)
  return moved
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function buildSamplePreset(
  stockCode: string,
  investType: number,
  period: BacktestPeriod,
): BacktestPreset {
  const info = findInvestType(investType)
  const months =
    PERIODS.find((item) => item.period === period)?.months ?? 12

  const pick = createPicker(hashSeed(`${stockCode}:${investType}:${period}`))

  /*
   * 성향이 공격적일수록 변동성과 수익률이 함께 커지게 기울인다.
   * 안정형인데 MDD가 40%로 나오면 화면은 멀쩡해도 보는 사람이 먼저 이상하게 여긴다.
   */
  const risk = investType / 5

  const volatility = pick(0.12, 0.16) + risk * pick(0.1, 0.2)
  const mdd = volatility * pick(0.6, 1.1)
  const annualReturn = pick(-0.05, 0.15) + risk * pick(0.1, 0.5)
  // 누적수익률은 연평균을 기간만큼 굴린 값에 가깝게 둔다
  const totalReturn = annualReturn * (months / 12) * pick(0.85, 1.15)
  const positionCount = Math.round(pick(2, 6) + risk * pick(4, 14))

  const result: BacktestPreset['result'] = {
    stockCode,
    investType,
    finalScore: 0, // 축 점수를 낸 뒤 아래에서 채운다
    stable: {
      mdd,
      volatility,
      dVolatility: volatility * pick(0.55, 0.8),
    },
    profit: {
      totalReturn,
      annualReturn,
      avgTradeReturn:
        positionCount === 0 ? 0 : totalReturn / positionCount,
    },
    effect: {
      sharpeRatio: pick(0.2, 2.1),
      sortinoRatio: pick(0.3, 2.8),
      calmarRatio: pick(0.2, 2.4),
    },
    growth: {
      momentumRatio: pick(-0.12, 0.22),
      volGrowthRatio: pick(-0.15, 0.45),
      positionCount,
    },
  }

  /*
   * 최종 점수는 지어내지 않는다. 축 점수를 성향 가중치로 합쳐 실제 공식대로 낸다.
   * 그래야 화면에 나란히 놓인 축 점수와 총점이 서로 맞는다.
   */
  const axisScores = calculateAxisScores(result)
  const weights = info?.weights
  result.finalScore =
    weights === undefined
      ? 0
      : AXES.reduce((sum, axis) => sum + axisScores[axis] * weights[axis], 0)

  /* 배치가 도는 시각(새벽 4시)에 맞춰, 마지막 일봉은 어제로 둔다 */
  const endDate = new Date()
  endDate.setDate(endDate.getDate() - 1)
  const updatedAt = new Date(endDate)
  updatedAt.setDate(updatedAt.getDate() + 1)
  updatedAt.setHours(4, 0, 0, 0)

  return {
    stockCode,
    investType,
    period,
    startDate: toIsoDate(minusMonths(endDate, months)),
    endDate: toIsoDate(endDate),
    updatedAt: updatedAt.toISOString(),
    result,
  }
}
