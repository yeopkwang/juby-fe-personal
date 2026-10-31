// 브라우저 전역을 흉내 내고 loader.mjs를 건다. 테스트 파일보다 먼저 돈다(--import)
import { register } from 'node:module'

class MemoryStorage {
  #map = new Map()
  getItem(key) { return this.#map.has(key) ? this.#map.get(key) : null }
  setItem(key, value) { this.#map.set(String(key), String(value)) }
  removeItem(key) { this.#map.delete(key) }
  clear() { this.#map.clear() }
  get length() { return this.#map.size }
  key(index) { return [...this.#map.keys()][index] ?? null }
}

globalThis.__viteEnv = { VITE_API_ORIGIN: 'https://api.example.test', DEV: false, PROD: true, MODE: 'test' }
globalThis.localStorage = new MemoryStorage()
globalThis.sessionStorage = new MemoryStorage()
globalThis.window = globalThis
globalThis.location = new URL('https://juby.example.test/')
globalThis.addEventListener = () => {}
globalThis.removeEventListener = () => {}
globalThis.document = { title: '', getElementById: () => null, documentElement: { style: {} }, fonts: { ready: Promise.resolve() } }
// Node 21+는 navigator가 getter뿐이라 대입이 막힌다. 앱 코드가 쓰는 건 없고, 있으면 그대로 둔다
if (!('navigator' in globalThis)) Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node-test' }, configurable: true })

register('./loader.mjs', import.meta.url)
