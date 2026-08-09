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
   * ⛔ 개발 프록시를 막아 뒀다.
   *
   * 이게 개발 중 /api·/v1을 백엔드로 넘겨주던 통로다. 백엔드가 한국투자증권 API를
   * 중계하는 구조라 증권사 계정이 정지될 수 있다는 경고를 받아 끊어 뒀다.
   *
   * 실제 차단은 src/api/client.ts의 API_DISABLED가 한다. 여기는 두 번째 자물쇠다.
   * 그쪽을 실수로 켜더라도 개발 중에는 요청이 백엔드까지 못 가고 dev 서버에서 404로 끝난다.
   *
   * 되돌릴 때는 아래 주석을 풀고 client.ts의 API_DISABLED도 false로 바꾼다.
   */
  // server: {
  //   proxy: {
  //     '/api': { target: 'http://3.35.191.42:8080', changeOrigin: true },
  //     '/v1': { target: 'http://3.35.191.42:8080', changeOrigin: true },
  //   },
  // },
})
