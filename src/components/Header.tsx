import { LogoMark, LogoWord } from './Logo'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useIsLoggedIn } from '../hooks/useIsLoggedIn'
import styles from './Header.module.css'

interface NavItemProps {
  to: string
  children: ReactNode
}

/**
 * 헤더 메뉴 한 칸. 지금 보고 있는 화면이면 표시가 붙는다.
 *
 * NavLink는 지금 주소와 맞으면 알아서 표시를 붙여 준다. Link만 쓰던 때는 백테스트 화면에
 * 있어도 헤더의 '주식 백테스트'가 다른 메뉴와 똑같이 생겨서, 화면 다섯 개를
 * 오가는 동안 지금 어디에 있는지 알 방법이 없었다.
 * aria-current="page"도 NavLink가 알아서 붙여 화면을 읽어 주는 도구에도 전해진다.
 *
 * 로고는 이걸 쓰지 않고 아래에서 Link로 직접 그린다. 늘 같은 자리에 있고 '/'로 가는
 * 길이라, 표시를 붙이면 홈에서만 로고 생김새가 달라져 오히려 눈에 걸린다.
 */
function NavItem({ to, children }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => (isActive ? styles.active : '')}
    >
      {children}
    </NavLink>
  )
}

export default function Header() {
  /* 그리는 순간 한 번 읽는 게 아니라 계속 지켜본다. 로그인하면 이 줄이 다시 돈다 */
  const loggedIn = useIsLoggedIn()

  return (
    <header className={styles.header}>
      <nav className={styles.menu}>
        <NavItem to="/backtest">주식 백테스트</NavItem>
        <NavItem to="/ai">AI 주가분석</NavItem>
      </nav>

      {/* 심볼은 aria-hidden, 글자 쪽이 'JUBY'라는 이름을 낸다 */}
      <Link to="/" className={styles.logo}>
        <LogoMark className={styles.logoMark} />
        <LogoWord className={styles.logoWord} />
      </Link>

      <nav className={`${styles.menu} ${styles.right}`}>
        <NavItem to="/guide">사용설명서</NavItem>
        {loggedIn ? (
          <NavItem to="/mypage">마이페이지</NavItem>
        ) : (
          <NavItem to="/login">로그인</NavItem>
        )}
      </nav>
    </header>
  )
}
