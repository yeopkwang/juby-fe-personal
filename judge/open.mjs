// 사용자가 직접 둘러보는 창: 가짜 /api + 가짜 토큰으로 로그인 화면을 연다. 창을 닫으면 끝난다.
// node open.mjs <BASE> [path]
import { chromium } from 'playwright'
import { mock, seedLogin } from './mock.mjs'

const [BASE, PATH = '/stocks/005930'] = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1920,1080'] })
const context = await browser.newContext({ viewport: null })
await seedLogin(context)
await mock(context)
const page = await context.newPage()
await page.goto(BASE + PATH)
console.log('opened', BASE + PATH)
await new Promise((resolve) => { browser.on('disconnected', resolve); page.on('close', () => { if (context.pages().length === 0) resolve() }) })
console.log('closed')
process.exit(0)
