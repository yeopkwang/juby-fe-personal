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
import AiPage from './pages/AiPage'
import StockChartPage from './pages/StockChartPage'
import LoginPage from './pages/LoginPage'
import OAuthCallbackPage from './pages/OAuthCallbackPage'
import MypageLayout from './components/MypageLayout'
import MypagePersonalityPage from './pages/MypagePersonalityPage'
import MypageProfilePage from './pages/MypageProfilePage'
import NotReadyPage from './pages/NotReadyPage'
import styles from './App.module.css'

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

          <Route path="/login" element={<LoginPage />} />
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
          {/* 투자성향테스트는 personality.html에 따로 있다. 로그인이 붙을 때 여기로 들인다 */}
          <Route path="*" element={<NotReadyPage />} />
        </Routes>
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
