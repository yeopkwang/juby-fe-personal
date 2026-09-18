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

    const entry: unknown = JSON.parse(raw)
    /*
     * 모양부터 확인한다. 예전 버전이 다른 모양으로 저장했거나 사람이 손댄 값이면
     * savedAt이 없는데, 그때 Date.now() - undefined 는 NaN이라 "> maxAgeMs"가
     * 거짓이 되어 만료 검사를 그냥 통과했다. 모양이 다르면 없는 셈 친다.
     */
    if (typeof entry !== 'object' || entry === null) return null
    if (!('savedAt' in entry) || !('value' in entry)) return null
    const { savedAt, value } = entry as Entry<T>
    if (typeof savedAt !== 'number' || Date.now() - savedAt > maxAgeMs) {
      return null
    }

    return value
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
