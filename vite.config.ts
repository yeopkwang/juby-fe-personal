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
   * 개발 중 /api를 백엔드로 넘겨주는 통로다(브라우저 CORS 우회).
   *
   * 두 번째 자물쇠. 진짜 판단은 src/api/client.ts의 ALLOWED_PREFIXES가 하지만,
   * 거기를 실수로 건드리더라도 개발 중에는 요청이 백엔드까지 못 가고 404로 끝난다.
   * 목록을 일부러 두 곳에 따로 적어 둔다 — 한쪽을 지워도 다른 쪽이 남는다.
   * 바꿀 때는 두 곳을 같이 바꾼다.
   *
   * `/v1`은 통째로 없다. 지금 프론트가 그 아래에서 부르는 건 AI 세션과 로그아웃뿐인데
   * 둘 다 노션 완료 목록에 없다. 통로 자체를 안 뚫으면 실수로도 못 나간다.
   *
   * bypass가 경로를 그대로 돌려주면 vite가 '프록시 말고 그 파일을 찾아라'로 알아듣고,
   * 그런 파일은 없으므로 404가 된다. 백엔드로는 한 글자도 나가지 않는다.
   */
  server: {
    proxy: {
      '/api': {
        target: 'http://3.35.191.42:8080',
        changeOrigin: true,
        bypass: (req) => {
          const url = req.url ?? ''
          const allowed = [
            '/api/backtest',
            '/api/personality-tests',
            '/api/members/me',
          ]
          if (allowed.some((prefix) => url.startsWith(prefix))) {
            return undefined
          }
          console.log(`[차단] 허용 목록에 없음: ${url}`)
          return url
        },
      },
    },
  },
})
