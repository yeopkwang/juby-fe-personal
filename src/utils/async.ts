export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 한 번에 size개씩 나눠서 처리한다.
 * 동시에 많이 던지면 백엔드가 중계하는 한국투자증권 호출 제한에 걸려 500이 섞여 돌아온다.
 * gapMs를 주면 묶음 사이에 그만큼 쉰다. 순차로 붙여 보내도 제한에 걸리는 API에 쓴다.
 */
export async function settleInChunks<T, R>(
  items: T[],
  size: number,
  task: (item: T) => Promise<R>,
  gapMs = 0,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = []

  for (let index = 0; index < items.length; index += size) {
    if (index > 0 && gapMs > 0) await delay(gapMs)
    const chunk = items.slice(index, index + size)
    results.push(...(await Promise.allSettled(chunk.map(task))))
  }

  return results
}

/** 실패하면 잠깐 쉬었다가 다시 시도한다. 호출 제한으로 인한 500은 대개 재시도로 복구된다 */
export async function withRetry<T>(
  task: () => Promise<T>,
  retries = 1,
  delayMs = 300,
): Promise<T> {
  try {
    return await task()
  } catch (error) {
    if (retries <= 0) throw error
    await delay(delayMs)
    return withRetry(task, retries - 1, delayMs)
  }
}
