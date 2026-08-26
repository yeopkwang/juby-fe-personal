import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { routePreload } from './plugins/route-preload.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),

    /*
     * 주소를 직접 치고 들어왔을 때 그 화면 묶음을 먼저 받게 한다.
     * 왜 필요한지·어떻게 어긋나는지는 plugins/route-preload.ts에 적었다.
     *
     * ⚠️ 이 표는 App.tsx의 라우트를 손으로 옮겨 적은 것이다. 주소를 바꾸면 여기도
     * 바꾼다. 안 바꾸면 그 화면만 조용히 느려질 뿐 깨지지는 않는다 — 그래서 굳이
     * 라우트를 데이터로 바꾸는 큰 공사를 하지 않았다.
     *
     * 홈(/)은 없다. 엔트리에 들어 있어 미리 받을 것이 없다.
     */
    routePreload([
      { path: '/stocks/:stockCode', modules: ['src/pages/StockChartPage.tsx'] },
      { path: '/backtest', modules: ['src/pages/BacktestPage.tsx'] },
      { path: '/ai', modules: ['src/pages/AiPage.tsx'] },
      { path: '/guide', modules: ['src/pages/GuidePage.tsx'] },
      { path: '/login', modules: ['src/pages/LoginPage.tsx'] },
      {
        path: '/personality-test',
        modules: ['src/pages/PersonalityTestPage.tsx'],
      },
      {
        path: '/personality-test/result',
        modules: ['src/pages/PersonalityResultPage.tsx'],
      },
      /*
       * 마이페이지는 껍데기와 내용이 나뉘어 있다. 껍데기만 적으면 그것을 받아
       * 읽은 뒤에야 내용을 부르러 가서 계단이 그대로 남는다(pages/lazy.ts의
       * loadMypageEntry가 같은 이유로 둘을 함께 받는다).
       */
      {
        path: '/mypage',
        modules: [
          'src/components/MypageLayout.tsx',
          'src/pages/MypagePersonalityPage.tsx',
        ],
      },
      {
        path: '/mypage/personality',
        modules: [
          'src/components/MypageLayout.tsx',
          'src/pages/MypagePersonalityPage.tsx',
        ],
      },
      {
        path: '/mypage/profile',
        modules: [
          'src/components/MypageLayout.tsx',
          'src/pages/MypageProfilePage.tsx',
        ],
      },
      /*
       * ⚠️ 마이페이지 주소로 들어온 사람이 로그인 상태가 아니면 로그인 화면으로
       * 밀려나므로, 여기서 미리 받은 것이 헛것이 된다(실측 6건, 20KB 남짓).
       * 알면서 그냥 둔다. 걸러내려면 이 script가 토큰을 읽어야 하는데, 토큰은
       * utils/auth.ts 한 곳에서만 만지기로 한 규칙이 있다. 20KB를 아끼자고
       * 그 규칙에 구멍을 내는 쪽이 더 비싸다.
       */
    ]),
  ],
  /*
   * 시작 파일은 index.html 하나다(vite의 기본값이라 따로 적지 않는다).
   *
   * 예전에는 personality.html이 하나 더 있었다. 투자성향테스트만 띄우는 별도 페이지로,
   * 로그인이 붙기 전까지 본 앱과 섞이지 않게 떼어 둔 것이었다. 이제 본 앱 라우트
   * (/personality-test)로 합쳤다.
   */
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
            '/api/stocks',
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
