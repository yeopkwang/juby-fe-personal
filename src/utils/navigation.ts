/**
 * 컴포넌트가 아닌 곳에서 화면을 옮기기 위한 다리. 지금은 `client.ts`의 401 처리만 쓴다.
 *
 * react-router의 navigate는 컴포넌트 안에서만 얻을 수 있다. 그래서 App이 그려질 때
 * 여기에 맡겨 두고, 바깥에서는 `goTo()`로 부른다. 맡겨진 게 없으면(아직 안 그려졌거나
 * 라우터 밖이면) 주소창을 통째로 바꾸는 예전 방식으로 물러선다 — 못 옮기는 것보다 낫다.
 */
type Navigate = (path: string) => void

let navigate: Navigate | null = null

/** App이 자기 navigate를 맡긴다. 떠날 때 null로 되돌린다 */
export function setNavigator(next: Navigate | null): void {
  navigate = next
}

export function goTo(path: string): void {
  if (navigate === null) {
    window.location.href = path
    return
  }
  navigate(path)
}
