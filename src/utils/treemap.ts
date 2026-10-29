/**
 * 칸 나누기(squarified treemap, Bruls·Huizing·van Wijk 2000). 주식 모아보기의 "한눈에 보기" 지도가 쓴다.
 * 값이 큰 것부터 넓이를 나눠 주되, 칸이 길쭉해지지 않게 한 줄씩 채운다. 라이브러리를 들이지 않으려고 직접 짰다.
 * 값이 0 이하이거나 숫자가 아니면 floorShare(전체의 몇 분의 일)만큼은 준다 — 거래대금이 비어 온 종목도 칸이 보여야 한다.
 */
interface TreemapRect<T> {
  item: T
  x: number
  y: number
  width: number
  height: number
}

export function squarify<T>(
  items: T[],
  valueOf: (item: T) => number,
  width: number,
  height: number,
  floorShare = 0.04,
): TreemapRect<T>[] {
  if (items.length === 0 || width <= 0 || height <= 0) return []

  const raw = items.map((item) => {
    const value = valueOf(item)
    return Number.isFinite(value) && value > 0 ? value : 0
  })
  const rawTotal = raw.reduce((sum, value) => sum + value, 0)
  const floor = rawTotal === 0 ? 1 : rawTotal * floorShare
  const values = raw.map((value) => Math.max(value, floor))
  const total = values.reduce((sum, value) => sum + value, 0)

  const nodes = items
    .map((item, index) => ({ item, area: (values[index] / total) * width * height }))
    .sort((a, b) => b.area - a.area)

  const out: TreemapRect<T>[] = []
  let x = 0
  let y = 0
  let w = width
  let h = height
  let row: typeof nodes = []

  /** 지금 줄에 놓인 칸들 중 가장 길쭉한 칸의 비율(1에 가까울수록 정사각형) */
  const worst = (candidate: typeof nodes, side: number) => {
    const sum = candidate.reduce((acc, node) => acc + node.area, 0)
    return Math.max(
      ...candidate.map((node) =>
        Math.max((side * side * node.area) / (sum * sum), (sum * sum) / (side * side * node.area)),
      ),
    )
  }

  const place = () => {
    const sum = row.reduce((acc, node) => acc + node.area, 0)
    if (w >= h) {
      const columnWidth = sum / h
      let cursor = y
      for (const node of row) {
        const nodeHeight = node.area / columnWidth
        out.push({ item: node.item, x, y: cursor, width: columnWidth, height: nodeHeight })
        cursor += nodeHeight
      }
      x += columnWidth
      w -= columnWidth
    } else {
      const rowHeight = sum / w
      let cursor = x
      for (const node of row) {
        const nodeWidth = node.area / rowHeight
        out.push({ item: node.item, x: cursor, y, width: nodeWidth, height: rowHeight })
        cursor += nodeWidth
      }
      y += rowHeight
      h -= rowHeight
    }
    row = []
  }

  for (const node of nodes) {
    const side = Math.min(w, h)
    if (row.length > 0 && worst([...row, node], side) > worst(row, side)) place()
    row.push(node)
  }
  if (row.length > 0) place()
  return out
}
