/**
 * index.css의 토큰 값. 캔버스에 그리는 차트(lightweight-charts)는 CSS 변수를 못 읽어서, 그릴 때 값을 꺼내 넘긴다.
 * 색을 코드에 다시 적지 않으려는 것이다 — 토큰을 바꾸면 차트도 따라 바뀐다. SVG는 style에 `var(--…)`를 그대로 쓴다.
 */
export function cssToken(name: `--${string}`): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
