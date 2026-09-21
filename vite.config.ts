import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  /*
   * 개발 중 /api 를 백엔드로 넘겨 CORS를 우회한다.
   * (2026-08~09에 증권사 계정 보호로 막아 뒀다가 홈이 1건 호출로 바뀌면서 다시 열었다.
   *  자세한 건 src/api/client.ts의 API_DISABLED 주석 참고)
   */
  server: {
    proxy: {
      '/api': { target: 'http://3.35.191.42:8080', changeOrigin: true },
    },
  },
})
