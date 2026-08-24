import { get } from './client'
import type { BacktestPeriod, BacktestPreset } from '../types/backtest'

/**
 * 백테스트 창구. 읽기 둘뿐이다.
 *
 * 요청 시점에 계산하지 않는다. 매일 새벽 배치가 종목×성향×기간 조합을 미리 돌려 DB에
 * 넣어 두고 여기서는 읽기만 한다. KIS가 섞이지 않아 다섯 번을 한꺼번에 보내도 된다.
 * 로그인도 필요 없다(SecurityConfig가 /api/**를 permitAll).
 *
 * ⚠️ `POST /api/backtest`는 없다. 다시 붙이지 않는다(2026-08-14 확인).
 * dev의 BacktestController 매핑이 `GET /preset`과 `GET /preset/options` 둘뿐이고,
 * 화면이 쓰던 여섯 수치는 프리셋 응답에 전부 들어 있다. 두 창구는 단위도 달라서
 * (프리셋 소수 0.39=39%, 실행 배수 1.39=39%) 섞으면 100배씩 어긋난다.
 */

/** 성향 하나가 고를 수 있는 기간 목록 */
export interface PresetOption {
  investType: number
  periods: { period: BacktestPeriod; label: string }[]
}

/**
 * 성향·기간 조합 하나의 결과.
 * 전략마다 지원 최소 기간이 달라 그보다 짧게 요청하면 400이다.
 * supportedPeriods()나 getPresetOptions()로 걸러서 부른다.
 */
export function getPreset(
  stockCode: string,
  investType: number,
  period: BacktestPeriod,
): Promise<BacktestPreset> {
  return get<BacktestPreset>(
    `/api/backtest/preset?stockCode=${encodeURIComponent(stockCode)}` +
      `&investType=${investType}&period=${period}`,
  )
}

/**
 * 성향별로 실제 DB에 적재된 기간 목록.
 * utils/backtest.ts의 사본은 화면을 즉시 그리기 위한 것이고 이쪽이 진짜다.
 */
export function getPresetOptions(): Promise<PresetOption[]> {
  return get<PresetOption[]>('/api/backtest/preset/options')
}
