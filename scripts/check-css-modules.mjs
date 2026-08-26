/*
 * styles.X 로 부르는데 .module.css에 그 클래스가 없는 곳을 찾는다.
 *
 * 없는 클래스를 부르면 undefined가 조용히 들어가 class 속성이 통째로 빠진다.
 * lint·tsc·build가 전부 통과하므로 도구로는 안 잡힌다 — e7baca9에서 실제로
 * 위험도 점 표시가 이렇게 사라졌고(CSS만 지우고 TSX는 남김) 화면을 캡처해
 * 비교하고 나서야 알았다.
 *
 * 반대 방향(안 쓰는 CSS 클래스)은 일부러 넣지 않았다. 오탐이 섞인 검사는
 * 시간이 지나면 통째로 무시된다. 이 검사의 가치는 "걸리면 진짜"라는 신뢰다.
 * 같은 이유로 동적 접근(styles[변수])은 정적으로 알 수 없어 검사하지 않는다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (/\.tsx?$/.test(path)) files.push(path.replace(/\\/g, '/'))
  }
}
walk('src')

const bad = []
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const imported = source.match(/import\s+styles\s+from\s+'([^']+\.module\.css)'/)
  if (imported === null) continue

  const cssPath = resolve(dirname(file), imported[1])
  let css
  try {
    css = readFileSync(cssPath, 'utf8')
  } catch {
    bad.push(`${file} → ${imported[1]} (파일 없음)`)
    continue
  }

  /* 주석 속 낱말까지 정의로 세지만, 그쪽으로 틀리면 못 잡을 뿐 오탐은 안 난다 */
  const defined = new Set(
    [...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map((match) => match[1]),
  )

  for (const match of source.matchAll(/styles\.([A-Za-z]\w*)/g)) {
    if (defined.has(match[1])) continue
    const line = source.slice(0, match.index).split('\n').length
    bad.push(`${file}:${line} → styles.${match[1]} (정의 없음)`)
  }
}

for (const line of bad) console.error(line)
console.log(`CSS Modules 대조: ${bad.length}건`)
process.exit(bad.length === 0 ? 0 : 1)
