/**
 * 같은 탭에서 잠깐 다시 쓰는 값(상세 1분, 뉴스 10분 — 사용자 결정 2026-09-27). 메모리에만 두므로 새로고침하면 비고,
 * 실패는 담지 않는다(부르는 쪽이 성공만 넣는다). 읽을 때만 만료를 보므로 오래 열어 둔 탭에서는 지난 항목이 남을 수 있다 —
 * 상세는 종목마다 전체 일봉을 들어 수 MB까지 갈 수 있지만 체감 장애는 아니라 그대로 둔다(docs/남은-일.md).
 */
export interface Memo<T> {
  savedAt: number
  value: T
}

/** 담은 지 maxAge 안이면 그 값, 지났으면 지우고 null */
export function readMemo<T>(memo: Map<string, Memo<T>>, key: string, maxAge: number): T | null {
  const entry = memo.get(key)
  if (entry === undefined) return null
  if (Date.now() - entry.savedAt > maxAge) {
    memo.delete(key)
    return null
  }
  return entry.value
}
