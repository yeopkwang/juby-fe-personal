import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import HomePage from './pages/HomePage'
import StockChartPage from './pages/StockChartPage'
import NotReadyPage from './pages/NotReadyPage'
import styles from './App.module.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className={styles.page}>
        <Header />
        <main className={styles.main}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/stocks/:stockCode" element={<StockChartPage />} />
            <Route path="*" element={<NotReadyPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
