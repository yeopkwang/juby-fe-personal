import { readJson, writeJson } from './cache'
import { PERIODS } from './backtest'
import { isStockCode } from '../api/stock'
import type { BacktestPeriod } from '../types/backtest'

/**
 * 최근 본 백테스트. 서버는 실행 결과를 저장하지 않아서(`/api/backtest/run`은 저장하지 않고 프리셋은 배치가 덮어쓴다)
 * **이 브라우저에만** 남긴다 — 다른 기기에서는 보이지 않고, 화면도 그렇게 적는다(마이페이지 한눈에 보기).
 * 로그아웃·탈퇴하면 지운다(api/auth.ts logout, MypageProfilePage) — 같은 브라우저를 쓰는 다른 회원에게 보이지 않게.
 * 토큰 만료로 풀린 것은 지우지 않는다. 같은 사람이 다시 로그인하는 경우가 대부분이다.
 */
interface RecentBacktest {
  stockCode: string
  stockName: string
  investType: number
  period: BacktestPeriod
  finalScore: number
  /** 본 때(ms) */
  viewedAt: number
}

const KEY = 'recentBacktests'
/** 마이페이지가 보여 주는 줄 수보다 넉넉히 둔다. 같은 조건은 한 줄로 합친다 */
const MAX_ENTRIES = 10

function isRecent(value: unknown): value is RecentBacktest {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return (
    typeof row.stockCode === 'string' &&
    isStockCode(row.stockCode) &&
    typeof row.stockName === 'string' &&
    row.stockName.trim() !== '' &&
    typeof row.investType === 'number' &&
    Number.isInteger(row.investType) &&
    PERIODS.some((item) => item.period === row.period) &&
    typeof row.finalScore === 'number' &&
    Number.isFinite(row.finalScore) &&
    typeof row.viewedAt === 'number' &&
    Number.isFinite(row.viewedAt)
  )
}

/** 최근 본 순. 모양이 틀린 줄은 빼고 읽는다 */
export function readRecentBacktests(): RecentBacktest[] {
  const saved = readJson(KEY)
  if (!Array.isArray(saved)) return []
  return saved.filter(isRecent).sort((left, right) => right.viewedAt - left.viewedAt)
}

/** 결과를 받을 때마다 맨 앞에 넣는다. 같은 종목·전략·기간이면 옛 줄을 지우고 새로 넣는다 */
export function rememberBacktest(entry: Omit<RecentBacktest, 'viewedAt'>): void {
  const others = readRecentBacktests().filter(
    (row) =>
      row.stockCode !== entry.stockCode ||
      row.investType !== entry.investType ||
      row.period !== entry.period,
  )
  writeJson(KEY, [{ ...entry, viewedAt: Date.now() }, ...others].slice(0, MAX_ENTRIES))
}

export function forgetRecentBacktests(): void {
  writeJson(KEY, [])
}
