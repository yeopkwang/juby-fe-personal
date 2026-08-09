import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { isLoggedIn } from '../utils/auth'
import styles from './Header.module.css'

interface HeaderProps {
  /**
   * 본 앱(index.html) 밖에서 쓰는 헤더인지.
   *
   * 투자성향테스트는 personality.html에 따로 떨어져 있고 MemoryRouter를 쓴다.
   * 거기서 Link를 누르면 주소창을 건드리지 않고 메모리 안에서만 움직이는데,
   * 본 앱 경로는 그 라우터에 없으므로 * 규칙에 걸려 첫 문항으로 되돌아온다.
   * 진짜로 다른 페이지를 받아와야 하므로 a로 그려 브라우저가 통째로 이동하게 한다.
   */
  standalone?: boolean
}

interface NavItemProps {
  to: string
  standalone: boolean
  className?: string
  children: ReactNode
}

/** 같은 메뉴를 라우터 안에서는 Link로, 밖에서는 a로 그린다 */
function NavItem({ to, standalone, className, children }: NavItemProps) {
  if (standalone) {
    return (
      <a href={to} className={className}>
        {children}
      </a>
    )
  }

  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  )
}

export default function Header({ standalone = false }: HeaderProps) {
  return (
    <header className={styles.header}>
      <nav className={styles.menu}>
        <NavItem to="/backtest" standalone={standalone}>
          주식 백테스트
        </NavItem>
        <NavItem to="/ai" standalone={standalone}>
          AI 주가분석
        </NavItem>
      </nav>

      <NavItem to="/" standalone={standalone} className={styles.logo}>
        JUBY
      </NavItem>

      <nav className={`${styles.menu} ${styles.right}`}>
        <NavItem to="/guide" standalone={standalone}>
          사용설명서
        </NavItem>
        {isLoggedIn() ? (
          <NavItem to="/mypage" standalone={standalone}>
            마이페이지
          </NavItem>
        ) : (
          <NavItem to="/login" standalone={standalone}>
            로그인
          </NavItem>
        )}
      </nav>
    </header>
  )
}
