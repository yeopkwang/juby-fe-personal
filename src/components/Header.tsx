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
        {isLoggedIn() ? (
          <Link to="/mypage/profile">마이페이지</Link>
        ) : (
          <Link to="/login">로그인</Link>
        )}
      </nav>
    </header>
  )
}
