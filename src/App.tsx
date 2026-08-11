import { Suspense, lazy } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import Header from './components/Header'
import ScrollToTop from './components/ScrollToTop'
import HomePage from './pages/HomePage'
import styles from './App.module.css'

/*
 * 홈만 미리 넣어 두고 나머지는 들어갈 때 받는다.
 *
 * 홈은 첫 화면이라 늦게 받으면 흰 화면이 한 번 더 생긴다.
 * 반면 상세(lightweight-charts)와 AI는 홈에서 쓰지 않는데도 같은 묶음에 들어 있어
 * 홈 첫 로딩을 통째로 늦추고 있었다.
 */
const StockChartPage = lazy(() => import('./pages/StockChartPage'))
const AiPage = lazy(() => import('./pages/AiPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const OAuthCallbackPage = lazy(() => import('./pages/OAuthCallbackPage'))
const MypageLayout = lazy(() => import('./components/MypageLayout'))
const MypagePersonalityPage = lazy(
  () => import('./pages/MypagePersonalityPage'),
)
const MypageProfilePage = lazy(() => import('./pages/MypageProfilePage'))
const GuidePage = lazy(() => import('./pages/GuidePage'))
const BacktestPage = lazy(() => import('./pages/BacktestPage'))
const NotReadyPage = lazy(() => import('./pages/NotReadyPage'))

/**
 * 로그인 화면은 회색 배경을 가장자리까지 채워야 해서 공통 좌우 여백을 쓰지 않는다.
 * useLocation은 BrowserRouter 안에서만 쓸 수 있어 App에서 한 겹 분리했다.
 */
function Layout() {
  const { pathname } = useLocation()
  const isLoginPage = pathname === '/login'

  return (
    <div className={styles.page}>
      <Header />

      <main className={isLoginPage ? styles.bareMain : styles.main}>
        {/*
          화면 묶음을 받는 동안 자리를 비워 둔다. 스피너를 넣으면 이미 캐시된 뒤에도
          껌뻑여서, 받아오는 시간이 짧을수록 오히려 어수선해진다.
        */}
        <Suspense fallback={<div className={styles.routeFallback} />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/ai" element={<AiPage />} />
            <Route path="/stocks/:stockCode" element={<StockChartPage />} />
            {/* 사이드바는 MypageLayout이 들고, 오른쪽 내용만 자식 라우트가 갈아끼운다 */}
            <Route path="/mypage" element={<MypageLayout />}>
              <Route
                index
                element={<Navigate to="/mypage/personality" replace />}
              />
              <Route path="personality" element={<MypagePersonalityPage />} />
              <Route path="profile" element={<MypageProfilePage />} />
            </Route>

            <Route path="/guide" element={<GuidePage />} />
            <Route path="/backtest" element={<BacktestPage />} />

            <Route path="/login" element={<LoginPage />} />
            <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
            {/* 투자성향테스트는 personality.html에 따로 있다. 로그인이 붙을 때 여기로 들인다 */}
            <Route path="*" element={<NotReadyPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Layout />
    </BrowserRouter>
  )
}
