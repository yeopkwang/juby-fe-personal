import { Link } from 'react-router-dom'
import { isLoggedIn } from '../utils/auth'
import styles from './Header.module.css'

/**
 * 모든 화면이 같이 쓰는 머리글.
 *
 * 로그인 여부는 그릴 때 한 번만 읽는다. 로그인·로그아웃 직후에는 부르는 쪽이
 * `window.location.href`로 페이지를 통째로 새로 받아야 여기가 갱신된다.
 */
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
          <Link to="/mypage">마이페이지</Link>
        ) : (
          <Link to="/login">로그인</Link>
        )}
      </nav>
    </header>
  )
}
