/**
 * 화면을 빨리 띄우려고 잠깐 저장해두는 값.
 * 토큰은 utils/auth.ts가 따로 맡는다. 여기 담기는 건 언제 사라져도 되는 것들뿐이라
 * 읽기·쓰기 어느 쪽이 실패해도 그냥 없는 셈 치고 넘어간다.
 */
interface Entry<T> {
  savedAt: number
  value: T
}

export function readCache<T>(key: string, maxAgeMs: number): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null

    const entry = JSON.parse(raw) as Entry<T>
    if (Date.now() - entry.savedAt > maxAgeMs) return null

    return entry.value
  } catch {
    return null
  }
}

export function writeCache<T>(key: string, value: T): void {
  const entry: Entry<T> = { savedAt: Date.now(), value }

  try {
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {
  }
}
