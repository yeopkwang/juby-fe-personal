import { get } from './client'
import type { BacktestPeriod, BacktestPreset } from '../types/backtest'

/**
 * 백테스트 창구. 둘 다 DB만 읽는다 — 새벽 4시 배치가 미리 계산해 둔 값이라
 * 증권사 호출이 없고 응답도 즉시 온다. 로그인도 필요 없다.
 */

/**
 * 종목·성향·기간의 미리 계산된 결과.
 *
 * 실패 코드:
 *   - BACKTEST404_1 종목 없음
 *   - BACKTEST404_5 아직 계산되지 않은 프리셋 (배치가 그 종목을 건너뛴 경우)
 *   - BACKTEST400_1 그 성향이 지원하지 않는 기간
 */
export function getPreset(
  stockCode: string,
  investType: number,
  period: BacktestPeriod,
): Promise<BacktestPreset> {
  const query = new URLSearchParams({
    stockCode,
    investType: String(investType),
    period,
  })
  return get<BacktestPreset>(`/api/backtest/preset?${query}`)
}

export interface PresetOptions {
  investType: number
  /** 이 성향으로 실제 DB에 계산되어 있는 기간. enum 순서(짧은 것부터)대로 온다 */
  periods: { period: BacktestPeriod; label: string }[]
}

/**
 * 성향별로 고를 수 있는 기간 목록.
 *
 * 종목과 무관한 전역 값이다(백엔드가 "어떤 종목이든 이 기간이 계산된 적 있나"로 만든다).
 * 그래서 목록에 있어도 특정 종목에는 없을 수 있고, 그때 getPreset이 BACKTEST404_5를 준다.
 */
export function getPresetOptions(): Promise<PresetOptions[]> {
  return get<PresetOptions[]>('/api/backtest/preset/options')
}
