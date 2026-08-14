import { get } from './client'
import type { BacktestPeriod, BacktestPreset } from '../types/backtest'

/**
 * 백테스트 창구. **읽기 둘뿐이다.**
 *
 * **요청 시점에 계산하지 않는다.** 매일 새벽 배치가 종목×성향×기간 조합을 미리 돌려
 * DB에 넣어 두고, 여기서는 그걸 읽기만 한다. 그래서 KIS 호출이 섞이지 않고 응답도 빠르다.
 * 홈·상세처럼 조심스럽게 나눠 부를 이유가 없어 다섯 번을 한꺼번에 보낸다.
 *
 * 로그인도 필요 없다. SecurityConfig가 /api/**를 permitAll로 열어 둬서
 * 토큰 없이 부른 응답을 실제로 확인했다.
 *
 * ⚠️ **`POST /api/backtest`는 없다. 다시 붙이지 않는다** (2026-08-14 확인).
 * 한때 '그 자리에서 돌리는 실행'을 따로 부르고 그 원시 지표를 결과 아래에 덧붙였는데,
 *   - 실서버가 `POST /api/backtest`도 `POST /api/backtest/run`도 404를 준다
 *   - dev 브랜치 `BacktestController`에 매핑이 `GET /preset`과 `GET /preset/options`
 *     **둘뿐이다**(전수 확인). 배포가 밀린 게 아니라 경로 자체가 없다
 *   - 무엇보다 그 화면에 쓰던 여섯 수치(누적수익률·연평균·샤프·최대낙폭·변동성·거래횟수)가
 *     **프리셋 응답에 전부 들어 있다.** 두 창구는 단위가 달라서(프리셋 소수 0.39=39%,
 *     실행 배수 1.39=39%) 섞이면 100배씩 어긋나는 위험만 남았다
 * 실행 결과가 필요하면 프리셋을 쓴다. 화면의 숫자는 이미 전부 거기서 나온다.
 */

/** 성향 하나가 고를 수 있는 기간 목록 */
export interface PresetOption {
  investType: number
  periods: { period: BacktestPeriod; label: string }[]
}

/**
 * 성향·기간 조합 하나의 결과.
 *
 * 전략마다 지원하는 최소 기간이 달라, 그보다 짧은 기간을 요청하면 **400이 온다.**
 * 부르기 전에 supportedPeriods()나 getPresetOptions()로 걸러야 한다.
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
 *
 * utils/backtest.ts에 같은 내용의 사본이 있는데 그건 화면을 즉시 그리기 위한 것이고,
 * 이쪽이 진짜다. 배치가 밀리거나 기간이 추가되면 사본과 달라질 수 있다.
 */
export function getPresetOptions(): Promise<PresetOption[]> {
  return get<PresetOption[]>('/api/backtest/preset/options')
}
