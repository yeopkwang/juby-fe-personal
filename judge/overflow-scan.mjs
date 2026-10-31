// 홈 601~670px 가로 넘침(docs/남은-일.md 6번) — 폭마다 scrollWidth - innerWidth
import { chromium } from 'playwright'
import { mock, seedLogin } from './mock.mjs'
const browser = await chromium.launch({ channel: 'chrome' })
for (const base of process.argv.slice(2)) {
  const bad = []
  for (let w = Number(process.env.FROM ?? 560); w <= Number(process.env.TO ?? 720); w += 10) {
    const context = await browser.newContext({ viewport: { width: w, height: 800 } })
    await seedLogin(context); await mock(context)
    const page = await context.newPage()
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500)
    const px = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    if (px > 0) bad.push(`${w}:${px}`)
    await context.close()
  }
  console.log(base, bad.length ? bad.join(' ') : `넘침 없음(${process.env.FROM ?? 560}~${process.env.TO ?? 720}, 10px 간격)`)
}
await browser.close()
