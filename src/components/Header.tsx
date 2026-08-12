import { LogoMark, LogoWord } from './Logo'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useIsLoggedIn } from '../hooks/useIsLoggedIn'
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
  /**
   * 로고처럼 자기 생김새가 따로 있는 항목만 넘긴다.
   * 이게 있으면 현재 위치 표시를 하지 않는다 — 아래 설명 참고.
   */
  className?: string
  children: ReactNode
}

/**
 * 같은 메뉴를 라우터 안에서는 NavLink로, 밖에서는 a로 그린다.
 *
 * NavLink는 지금 주소와 맞으면 표시를 붙여 준다. Link만 쓰던 때는 백테스트 화면에
 * 있어도 헤더의 '주식 백테스트'가 다른 메뉴와 똑같이 생겨서, 화면 다섯 개를
 * 오가는 동안 지금 어디에 있는지 알 방법이 없었다.
 * aria-current="page"도 NavLink가 알아서 붙여 화면을 읽어 주는 도구에도 전해진다.
 *
 * 로고는 제외한다. 늘 같은 자리에 있고 '/'로 가는 길이라, 표시를 붙이면 홈에서만
 * 로고 생김새가 달라져 오히려 눈에 걸린다.
 *
 * standalone(투자성향테스트)에서도 표시하지 않는다. 그쪽은 주소가 늘
 * /personality.html로 고정이라 맞아떨어지는 메뉴가 애초에 없다.
 */
function NavItem({ to, standalone, className, children }: NavItemProps) {
  if (standalone) {
    return (
      <a href={to} className={className}>
        {children}
      </a>
    )
  }

  if (className !== undefined) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    )
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) => (isActive ? styles.active : '')}
    >
      {children}
    </NavLink>
  )
}

export default function Header({ standalone = false }: HeaderProps) {
  /* 그리는 순간 한 번 읽는 게 아니라 계속 지켜본다. 로그인하면 이 줄이 다시 돈다 */
  const loggedIn = useIsLoggedIn()

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

      {/* 심볼은 aria-hidden, 글자 쪽이 'JUBY'라는 이름을 낸다 */}
      <NavItem to="/" standalone={standalone} className={styles.logo}>
        <LogoMark className={styles.logoMark} />
        <LogoWord className={styles.logoWord} />
      </NavItem>

      <nav className={`${styles.menu} ${styles.right}`}>
        <NavItem to="/guide" standalone={standalone}>
          사용설명서
        </NavItem>
        {loggedIn ? (
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
