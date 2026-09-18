import { ApiError } from '../api/client'

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 실패하면 잠깐 쉬었다가 다시 시도한다.
 *
 * 증권사를 거치는 요청(상세 현재가, 홈 카드)이 초당 제한에 걸려 500이 오면
 * 대개 한 번 더 부르는 것으로 복구된다. 반면 404(없는 종목)·400(잘못된 값)·401은
 * 다시 불러도 답이 같으므로 재시도하지 않고 바로 던진다.
 */
export async function withRetry<T>(
  task: () => Promise<T>,
  retries = 1,
  delayMs = 300,
): Promise<T> {
  try {
    return await task()
  } catch (error) {
    const isClientError =
      error instanceof ApiError && error.status >= 400 && error.status < 500
    if (retries <= 0 || isClientError) throw error
    await delay(delayMs)
    return withRetry(task, retries - 1, delayMs)
  }
}
