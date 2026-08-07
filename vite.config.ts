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
  server: {
    proxy: {
      '/api': { target: 'http://3.35.191.42:8080', changeOrigin: true },
      '/v1': { target: 'http://3.35.191.42:8080', changeOrigin: true },
    },
  },
})
