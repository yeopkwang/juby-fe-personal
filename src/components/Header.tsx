import { Link } from 'react-router-dom'
import { isLoggedIn } from '../utils/auth'
import styles from './Header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <nav className={styles.menu}>
        <Link to="/backtest">주식 백테스트</Link>
        <Link to="/ai">AI 주가분석</Link>
      </nav>

      <Link to="/" className={styles.logo}>
        JUBY
      </Link>

      <nav className={`${styles.menu} ${styles.right}`}>
        <Link to="/guide">사용설명서</Link>
        {/* /mypage는 아직 라우트가 없어 App.tsx의 * 규칙에 걸려 NotReadyPage로 간다 */}
        {isLoggedIn() ? (
          <Link to="/mypage">마이페이지</Link>
        ) : (
          <Link to="/login">로그인</Link>
        )}
      </nav>
    </header>
  )
}
