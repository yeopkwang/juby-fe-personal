import { BlockedPathError, isRetryable } from './error'

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 한 번에 size개씩 나눠서 처리한다.
 * 동시에 많이 던지면 백엔드가 중계하는 한국투자증권 호출 제한에 걸려 500이 섞여 돌아온다.
 * gapMs를 주면 묶음 사이에 그만큼 쉰다. 순차로 붙여 보내도 제한에 걸리는 API에 쓴다.
 *
 * shouldStop이 참을 돌려주면 남은 묶음을 버리고 여기까지의 결과만 반환한다.
 * 화면을 떠난 뒤에도 계속 도는 요청이 다음 화면의 요청을 뒤로 밀어내기 때문이다.
 * 한 묶음이 통째로 막힌 경로로 떨어졌을 때도 같이 버린다(allBlocked 참고).
 */
export async function settleInChunks<T, R>(
  items: T[],
  size: number,
  task: (item: T) => Promise<R>,
  gapMs = 0,
  shouldStop?: () => boolean,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = []

  for (let index = 0; index < items.length; index += size) {
    if (shouldStop?.() === true) break
    if (index > 0 && gapMs > 0) await delay(gapMs)
    const chunk = items.slice(index, index + size)
    const settled = await Promise.allSettled(chunk.map(task))
    results.push(...settled)
    if (allBlocked(settled)) break
  }

  return results
}

/**
 * 이 묶음이 통째로 '막힌 경로'로 떨어졌는가. 그렇다면 남은 묶음도 같은 창구를 쓰므로
 * 결과가 같다 — 부르지 않고 간격도 쉬지 않는다.
 *
 * ⚠️ 여기서 isRetryable을 쓰면 안 된다. 그쪽은 404도 '다시 물어도 소용없음'으로 치는데,
 * 404는 종목 하나가 없다는 뜻이지 다음 종목도 없다는 뜻이 아니다. 경로가 막힌 것만
 * 종목과 무관하게 전부에 해당한다.
 */
function allBlocked(results: PromiseSettledResult<unknown>[]): boolean {
  return (
    results.length > 0 &&
    results.every(
      (result) =>
        result.status === 'rejected' &&
        result.reason instanceof BlockedPathError,
    )
  )
}

/**
 * 실패하면 잠깐 쉬었다가 다시 시도한다. 호출 제한으로 인한 500은 대개 재시도로 복구된다.
 *
 * 다만 결과가 달라질 수 없는 실패는 곧바로 던진다(isRetryable). 쉬는 시간이 전부
 * 헛돈이기 때문이다 — 막힌 경로를 2회 재시도하던 홈은 종목마다 800ms씩 태우고 있었다.
 */
export async function withRetry<T>(
  task: () => Promise<T>,
  retries = 1,
  delayMs = 300,
): Promise<T> {
  try {
    return await task()
  } catch (error) {
    if (retries <= 0 || !isRetryable(error)) throw error
    await delay(delayMs)
    return withRetry(task, retries - 1, delayMs)
  }
}
