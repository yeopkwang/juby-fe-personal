import { DETAIL_PERIOD, getStockDetail } from './stock'
import type { StockDetail } from '../types/stock'

/**
 * 종목 상세를 **화면보다 먼저** 불러 둔다.
 *
 * ## 왜 필요한가
 *
 * 요청이 `useEffect` 안에 있으면 "화면이 한 번 그려진 다음"이라는 순서가 강제된다.
 * 깊은 링크로 들어온 경우 실측이 이랬다(10Mbps/150ms).
 *
 * ```
 * index.js        161ms → 454ms 도착
 * 상세 묶음        164ms → 433ms 도착
 * ────── 346ms 동안 아무 요청도 안 나감 (React가 켜지는 시간) ──────
 * /api/stocks     800ms → 1103ms
 * ```
 *
 * JS는 454ms에 이미 다 와 있는데 데이터는 800ms에야 부르러 간다. 그 사이를 없앤다.
 *
 * ## 규칙을 지키면서 하는 방법
 *
 * `<head>`에 script를 심어 fetch를 먼저 던지는 방법이 더 빠르지만(최대 1.2초),
 * 그러면 **fetch 창구가 `client.ts` 말고 하나 더 생긴다.** 게다가 브라우저가 그것을
 * 앱의 요청과 같은 것으로 쳐 주지 않으면 조용히 두 번 부르는데, 이 창구는 백엔드에서
 * KIS를 1건 부르므로 그 낭비가 곧 **KIS 호출 2건**이다. 그래서 그 길은 안 갔다.
 *
 * 여기서 하는 것은 **부르는 시점만 앞당기는 것**이다. 창구도 그대로, 횟수도 그대로다.
 *
 * ## 캐시가 아니다
 *
 * 한 번 가져가면 지운다(`takeWarmStockDetail`). 시세는 초 단위로 바뀌는 값이라
 * 들고 있다가 나중에 다시 내주면 옛날 값을 새 값인 척 보여주게 된다.
 * 가져가지 않고 남은 것도 `MAX_AGE`가 지나면 버린다 — 눌렀다가 딴 데로 간 경우다.
 */

/** 미리 불러 두고 이만큼 지나면 버린다. 시세로서 신선하다고 볼 수 있는 한계 */
const MAX_AGE = 30_000

interface Warm {
  stockCode: string
  promise: Promise<StockDetail>
  /** 부른 시각 */
  at: number
}

/**
 * 딱 하나만 들고 있는다. 여러 개를 모아 두면 표를 훑는 동안 요청이 쌓이는데,
 * 이 창구는 KIS를 부른다 — 홈이 102종목을 몰아쳐 계정 경고를 받은 그 자리다.
 */
let warm: Warm | null = null

/**
 * 지금 이 종목을 부르기 시작한다. 결과는 여기 보관했다가 화면이 가져간다.
 *
 * 같은 종목을 이미 부르는 중이면 아무것도 하지 않는다. 누르기를 여러 번 해도
 * 요청은 한 번이다.
 */
export function warmStockDetail(stockCode: string): void {
  if (warm !== null && warm.stockCode === stockCode && !isExpired(warm)) return

  const promise = getStockDetail(stockCode, DETAIL_PERIOD)

  /*
   * 아직 아무도 결과를 안 받아 갔는데 실패하면 브라우저가 '처리되지 않은 오류'로
   * 콘솔에 찍는다. 그 자리를 막아 두되 **원본은 건드리지 않는다** — 화면은 원본을
   * 받아 가야 실패의 종류(utils/error.ts)를 그대로 판단할 수 있다.
   */
  promise.catch(() => {})

  warm = { stockCode, promise, at: Date.now() }
}

/**
 * 미리 불러 둔 것이 있으면 가져간다. 없으면 `null` — 그때는 화면이 직접 부른다.
 *
 * 가져가는 즉시 비운다. 다시 부르기(재시도)가 옛날 결과를 다시 받는 일이 없어야 한다.
 */
export function takeWarmStockDetail(
  stockCode: string,
): Promise<StockDetail> | null {
  if (warm === null || warm.stockCode !== stockCode) return null

  const taken = warm
  warm = null
  return isExpired(taken) ? null : taken.promise
}

function isExpired(entry: Warm): boolean {
  return Date.now() - entry.at > MAX_AGE
}

/**
 * 링크를 **누르는 순간** 데이터도 부르러 보낸다.
 *
 * 마우스를 올릴 때가 아니라 누를 때인 이유: 표를 훑기만 해도 수십 종목이 나가면
 * 그게 전부 KIS 호출이다. 누르기는 실제로 옮겨 가는 1회당 1건이라 낭비가 없다.
 *
 * 왼쪽 버튼만 본다. 가운데 버튼(새 탭)이나 오른쪽 버튼(메뉴)은 **이 탭이 그 화면으로
 * 가지 않으므로** 여기서 부른 것이 그대로 버려진다.
 *
 * ⚠️ 그래도 헛도는 경우가 하나 남는다 — 눌렀다가 링크 밖에서 떼면(취소) 이동은
 * 안 하는데 요청은 이미 나갔다. 실측으로 그때 1건이 버려진다. 왼쪽 버튼을 누르는
 * 것은 거의 언제나 이동하겠다는 뜻이라 그 1건은 감수한다. 마우스를 올릴 때
 * 부르는 것과는 자릿수가 다르다(그쪽은 훑기만 해도 수십 건).
 *
 * 이벤트 타입을 React에서 가져오지 않고 필요한 것만 적었다. 이 파일이 화면 쪽을
 * 알 필요가 없다.
 */
export function warmOnPress(
  event: { button: number },
  stockCode: string,
): void {
  if (event.button !== 0) return
  warmStockDetail(stockCode)
}
