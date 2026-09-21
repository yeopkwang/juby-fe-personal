import { Link } from 'react-router-dom'
import { useIsLoggedIn } from '../hooks/useIsLoggedIn'
import styles from './Header.module.css'

/**
 * 모든 화면이 같이 쓰는 머리글.
 *
 * 로그인 여부는 구독해서 본다. 로그인·로그아웃·탈퇴 직후에도 여기가 알아서 바뀌므로
 * 부르는 쪽이 페이지를 통째로 새로 받을 필요가 없다.
 */
export default function Header() {
  const loggedIn = useIsLoggedIn()

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
        {loggedIn ? (
          <Link to="/mypage">마이페이지</Link>
        ) : (
          <Link to="/login">로그인</Link>
        )}
      </nav>
    </header>
  )
}
