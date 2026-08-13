import { get, post } from './client'
import type {
  BacktestPeriod,
  BacktestPreset,
  BacktestRun,
  BacktestRunRequest,
} from '../types/backtest'

/**
 * 백테스트 창구.
 *
 * **요청 시점에 계산하지 않는다.** 매일 새벽 배치가 종목×성향×기간 조합을 미리 돌려
 * DB에 넣어 두고, 여기서는 그걸 읽기만 한다. 그래서 KIS 호출이 섞이지 않고 응답도 빠르다.
 * 홈·상세처럼 조심스럽게 나눠 부를 이유가 없어 다섯 번을 한꺼번에 보낸다.
 *
 * 로그인도 필요 없다. SecurityConfig가 /api/**를 permitAll로 열어 둬서
 * 토큰 없이 부른 응답을 실제로 확인했다.
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

/**
 * 서버가 받은 그대로의 모양.
 *
 * 연평균 수익률의 철자가 두 곳에서 다르다. 명세에는 `annulizedReturn`(a가 빠졌다),
 * 백엔드 `BacktestResDto.GetInfo`에는 `annualizedReturn`으로 적혀 있다.
 * 어느 쪽이 배포될지 모르므로 **둘 다 받아 두고 읽는 쪽에서 합친다.**
 * 한쪽만 믿었다가 틀리면 화면에 조용히 undefined가 박히는데, 숫자가 안 보이는 게 아니라
 * 엉뚱한 값이 보이는 쪽이 훨씬 나쁘다.
 */
type BacktestRunRaw = Omit<BacktestRun, 'annualizedReturn'> & {
  annualizedReturn?: number
  annulizedReturn?: number
}

/**
 * 고른 조건으로 **지금 이 자리에서** 백테스트를 돌린다.
 *
 * 프리셋 조회(getPreset)와 달리 미리 계산된 값을 읽는 게 아니라 서버가 계산한다.
 * 그래서 응답이 느릴 수 있고 **로그인이 필요하다** — 컨트롤러가
 * `@AuthenticationPrincipal`로 사용자를 꺼내므로 토큰 없이 부르면
 * 401이 아니라 NPE로 500이 난다(백엔드 전반이 그렇다. CLAUDE.md 참고).
 *
 * ⚠️ 2026-08-14 기준 **실서버에 아직 없다.** `POST /api/backtest`도
 * `POST /api/backtest/run`도 404다. 백엔드 소스에서도 `deploy/37` 브랜치에만 있고
 * dev·main에는 없다. 화면이 이 호출만 조용히 실패해도 나머지는 계속 보이게 해 둔 이유다.
 */
export async function runBacktest(
  request: BacktestRunRequest,
): Promise<BacktestRun> {
  const raw = await post<BacktestRunRaw>('/api/backtest', request)

  return {
    ...raw,
    /* 둘 다 없으면 0이 아니라 null이다. 0%는 '못 받았다'와 전혀 다른 뜻이다 */
    annualizedReturn: raw.annualizedReturn ?? raw.annulizedReturn ?? null,
  }
}
