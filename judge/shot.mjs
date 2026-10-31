// 빠른 확인용 캡처(배율 1). node shot.mjs <BASE> <화면,화면> <OUT> [폭x높이,...] [--full]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { mock, seedLogin } from './mock.mjs'
const [BASE, names, OUT, sizes = '1920x1080,1440x900,375x812'] = process.argv.slice(2)
const FULL = process.argv.includes('--full')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const handoff = (label) => async (page) => {
  await page.goto(BASE + '/stocks/005930', { waitUntil: 'domcontentloaded' }); await sleep(1500)
  await page.getByRole('link', { name: label }).first().click(); await sleep(2500)
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200)
}
const go = (path, wait = 1600) => async (page) => { await page.goto(BASE + path, { waitUntil: 'domcontentloaded' }); await sleep(wait) }
const SCREENS = {
  home: [true, go('/')], stock: [true, go('/stocks/005930', 2000)], 'stock-out': [false, go('/stocks/005930', 2000)],
  likes: [true, go('/likes')], backtest: [true, handoff('이 종목 백테스트')], 'backtest-empty': [true, go('/backtest')],
  ai: [true, handoff('AI에게 물어보기')], 'ai-empty': [true, go('/ai')], guide: [true, go('/guide')],
  'mypage-personality': [true, go('/mypage/personality')], 'mypage-profile': [true, go('/mypage/profile')],
  'personality-test': [true, go('/personality-test')], 'home-out': [false, go('/')], 'backtest-out': [false, go('/backtest')],
  'ai-out': [false, go('/ai')], login: [false, go('/login', 1200)], 'not-found': [false, go('/nope', 1200)],
}
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome' })
for (const name of names.split(',')) {
  const [login, run] = SCREENS[name]
  for (const size of sizes.split(',')) {
    const [width, height] = size.split('x').map(Number)
    const context = await browser.newContext({ viewport: { width, height } })
    await seedLogin(context, login)
    await mock(context)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await run(page)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `${OUT}/${name}-${width}.png`, fullPage: FULL })
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    console.log(`${name}-${width}: 넘침 ${over}px ${errors.length ? 'ERR ' + JSON.stringify(errors) : ''}`)
    await context.close()
  }
}
await browser.close()
