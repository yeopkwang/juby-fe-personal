import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import ScrollToTop from './components/ScrollToTop'
import HomePage from './pages/HomePage'
import StockChartPage from './pages/StockChartPage'
import LoginPage from './pages/LoginPage'
import OAuthCallbackPage from './pages/OAuthCallbackPage'
import PersonalityTestPage from './pages/PersonalityTestPage'
import PersonalityResultPage from './pages/PersonalityResultPage'
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
          <Route path="/stocks/:stockCode" element={<StockChartPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
          <Route path="/personality-test" element={<PersonalityTestPage />} />
          <Route
            path="/personality-test/result"
            element={<PersonalityResultPage />}
          />
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
