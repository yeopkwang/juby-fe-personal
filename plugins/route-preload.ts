import type { Plugin, Rollup } from 'vite'

/**
 * 주소 하나와, 그 주소를 그리는 데 필요한 화면 파일들.
 *
 * `path`는 App.tsx의 라우트와 같은 모양으로 적는다. `:code` 같은 자리는 아무 값이나
 * 받는 것으로 친다. 마이페이지처럼 껍데기와 내용이 나뉜 곳은 **둘 다** 적는다 —
 * 하나만 적으면 나머지 하나를 여전히 순서대로 기다린다.
 */
export interface PreloadRoute {
  path: string
  /** src 기준 경로. 예: `src/pages/StockChartPage.tsx` */
  modules: string[]
}

/**
 * 주소를 직접 치고 들어온 사람에게, 그 화면 묶음을 **첫 줄부터** 받게 한다.
 *
 * ## 무엇이 문제였나
 *
 * 홈에서 종목을 눌러 들어가는 길은 이미 빠르다(49ms). HomePage가 한가할 때
 * 미리 받아 두기 때문이다(pages/lazy.ts). 그런데 카톡으로 받은 링크처럼
 * **주소창에 /stocks/005930을 바로 치는 경우**는 그 미리받기가 없다. 순서가 이렇다.
 *
 * ```
 * index.html → index.js(85KB) 받아 실행 → 라우터가 "아 상세구나" 판단
 *                                        → 그제서야 StockChartPage(57KB) 요청
 * ```
 *
 * 두 번째 요청은 **첫 번째가 끝나야 시작된다.** 브라우저가 게을러서가 아니라,
 * 어느 화면인지를 아는 코드가 그 첫 번째 안에 들어 있어서다. 실측 +771ms.
 *
 * ## 어떻게 푸나
 *
 * 어느 화면인지는 **주소만 봐도 안다.** 라우터를 기다릴 이유가 없다.
 * 그래서 `<head>` 맨 앞에 아주 작은 script를 하나 심는다. 그것이 하는 일은
 * `location.pathname`을 아래 표와 맞춰 보고 `<link rel="modulepreload">`를 다는 것뿐이다.
 * 두 요청이 **나란히** 나가고, 라우터가 판단을 마쳤을 때는 이미 받아져 있다.
 *
 * ## 왜 index.html에 그냥 적지 않았나
 *
 * SPA라 **모든 주소가 같은 index.html 한 장**을 받는다. 거기에 상세 묶음을 적으면
 * 홈에 들어온 사람도, 로그인하러 온 사람도 차트 라이브러리 57KB를 같이 받는다.
 * 고치려던 것보다 더 큰 손해다. 그래서 파일 이름은 빌드가 정하고(해시가 붙는다)
 * **고르는 일만 브라우저가** 하도록 나눴다.
 *
 * ## 틀렸을 때 어느 쪽으로 틀리나
 *
 * - `modules`의 파일이 없어지면 **빌드가 실패한다.** 화면 파일을 옮기거나 이름을
 *   바꾸면 그 자리에서 안다.
 * - `path`가 App.tsx와 어긋나면 **아무 일도 안 일어난다.** 미리 받지 못할 뿐,
 *   틀린 것을 받거나 화면이 깨지지는 않는다. 자동으로 잡을 방법이 없는 쪽을
 *   일부러 '손해가 작은 쪽'에 뒀다.
 *
 * 개발 서버에는 걸지 않는다(`apply: 'build'`). 거기서는 묶음이 나뉘지도 않아
 * 미리 받을 것이 없다. 확인은 `npm run build && npm run preview`로 한다.
 */
export function routePreload(routes: PreloadRoute[]): Plugin {
  let base = '/'

  return {
    name: 'route-preload',
    apply: 'build',

    configResolved(config) {
      base = config.base
    },

    transformIndexHtml: {
      /* 다른 플러그인이 묶음을 다 만든 뒤라야 최종 파일 이름을 읽을 수 있다 */
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle
        if (bundle === undefined || routes.length === 0) return

        /*
         * 엔트리가 어차피 받는 것들. 여기 있는 파일을 또 적으면 같은 것을 두 번
         * 적는 꼴이라, 표를 만든 뒤 빼낸다.
         */
        const alreadyLoaded = new Set<string>()
        for (const item of Object.values(bundle)) {
          if (item.type === 'chunk' && item.isEntry) {
            collectFiles(bundle, item.fileName, alreadyLoaded)
          }
        }

        const table: [string, string[]][] = []
        for (const route of routes) {
          const files = new Set<string>()
          for (const module of route.modules) {
            const chunk = findChunk(bundle, module)
            if (chunk === undefined) {
              throw new Error(
                `[route-preload] ${route.path}가 가리키는 ${module}을 빌드 결과에서 못 찾았다. ` +
                  '화면 파일을 옮겼거나 이름을 바꿨다면 vite.config.ts의 목록도 같이 고친다.',
              )
            }
            collectFiles(bundle, chunk.fileName, files)
          }

          const needed = [...files].filter((file) => !alreadyLoaded.has(file))
          if (needed.length > 0) table.push([toPattern(route.path), needed])
        }

        if (table.length === 0) return

        /*
         * ⚠️ `<meta charset>` **뒤에** 넣는다. injectTo: 'head-prepend'를 쓰면 이
         * script가 charset보다 앞에 서는데, 그러면 charset이 파일의 첫 1024바이트
         * 밖으로 밀려난다(실측 2186바이트째). HTML 규칙상 그 안에 있어야 하고,
         * 이 파일에는 한글이 있다(`aria-label="불러오는 중"`). 서버가 헤더로
         * 인코딩을 알려주지 않으면 브라우저가 추측해서 글자가 깨진다.
         *
         * 그래서 태그를 vite에 맡기지 않고 자리를 직접 고른다.
         */
        const script = `<script>${runtimeScript(table, base)}</script>`
        const charset = /<meta[^>]+charset[^>]*>/i.exec(html)

        if (charset === null) {
          /* charset이 아예 없으면 밀어낼 것도 없다. 그때는 맨 앞이 가장 빠르다 */
          return [
            {
              tag: 'script',
              children: runtimeScript(table, base),
              injectTo: 'head-prepend',
            },
          ]
        }

        const at = charset.index + charset[0].length
        return {
          html: `${html.slice(0, at)}\n    ${script}${html.slice(at)}`,
          tags: [],
        }
      },
    },
  }
}

/** 이 파일이 실행될 때 딸려 오는 것 전부 — 자기 자신, 정적 import, 딸린 CSS */
function collectFiles(
  bundle: Rollup.OutputBundle,
  fileName: string,
  out: Set<string>,
): void {
  if (out.has(fileName)) return
  out.add(fileName)

  const chunk = bundle[fileName]
  if (chunk === undefined || chunk.type !== 'chunk') return

  /*
   * CSS도 넣는다. 넣지 않으면 묶음을 받아 실행한 뒤에야 CSS를 부르러 가서,
   * 없애려던 그 왕복이 한 칸 뒤에 다시 생긴다.
   */
  for (const css of chunk.viteMetadata?.importedCss ?? []) out.add(css)

  /* dynamicImports는 넣지 않는다. 그건 '들어가면 그때 받는 것'이라 지금 필요가 없다 */
  for (const next of chunk.imports) collectFiles(bundle, next, out)
}

function findChunk(
  bundle: Rollup.OutputBundle,
  module: string,
): Rollup.OutputChunk | undefined {
  const suffix = `/${module}`
  for (const item of Object.values(bundle)) {
    if (item.type !== 'chunk' || item.facadeModuleId === null) continue
    if (item.facadeModuleId.replace(/\\/g, '/').endsWith(suffix)) return item
  }
  return undefined
}

/** `/stocks/:stockCode` → `^/stocks/[^/]+$` */
function toPattern(path: string): string {
  const body = path
    .split('/')
    .map((part) =>
      part.startsWith(':')
        ? '[^/]+'
        : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('/')
  return `^${body}/?$`
}

/**
 * `<head>` 맨 앞에서 도는 코드. 여기서 하는 일이 많으면 안 된다 —
 * 이 script가 도는 동안 브라우저는 나머지 HTML을 못 읽는다.
 *
 * modulepreload를 모르는 브라우저(사파리 16 이하 등)에는 `preload as=script`로
 * 대신 단다. 받아 두는 효과는 같고, 미리 해석까지 해 두지 않을 뿐이다.
 * crossOrigin을 비워 두는 건 모듈이 어차피 CORS 방식으로 받아지기 때문이다.
 * 이게 없으면 받아 놓고도 "조건이 다르다"며 한 번 더 받는다.
 *
 * 통째로 try로 감쌌다. 여기서 하는 일은 **빨리 받아 두는 것뿐**이라 실패해도 화면은
 * 멀쩡해야 한다. relList가 없는 아주 오래된 브라우저에서 던질 수 있는데, 그때
 * 콘솔에 오류를 남길 이유가 없다 — 미리 못 받았을 뿐이다.
 */
function runtimeScript(table: [string, string[]][], base: string): string {
  return `(function(){try{var t=${JSON.stringify(table)},b=${JSON.stringify(base)},p=location.pathname,h=document.head,m=document.createElement('link').relList.supports('modulepreload');for(var i=0;i<t.length;i++){if(!new RegExp(t[i][0]).test(p))continue;for(var f=t[i][1],j=0;j<f.length;j++){var l=document.createElement('link'),c=f[j].slice(-4)==='.css';if(c){l.rel='preload';l.as='style'}else if(m){l.rel='modulepreload'}else{l.rel='preload';l.as='script';l.crossOrigin=''}l.href=b+f[j];h.appendChild(l)}break}}catch(e){}})()`
}
