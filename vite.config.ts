import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  /*
   * 화면이 두 벌이라 시작 파일도 두 개다.
   * index.html은 홈·상세 화면, personality.html은 투자성향테스트 전용이다.
   * 여기 적어두지 않으면 빌드할 때 index.html만 챙기고 나머지는 버린다.
   */
  build: {
    rollupOptions: {
      input: { main: 'index.html', personality: 'personality.html' },
    },
  },
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
