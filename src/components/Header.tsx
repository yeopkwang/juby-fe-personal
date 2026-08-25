import { LogoMark, LogoWord } from './Logo'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useIsLoggedIn } from '../hooks/useIsLoggedIn'
import {
  loadAiPage,
  loadBacktestPage,
  loadGuidePage,
  loadLoginPage,
  loadMypageLayout,
} from '../pages/lazy'
import styles from './Header.module.css'

interface NavItemProps {
  to: string
  /**
   * 이 메뉴가 여는 화면 묶음을 받아오는 함수(pages/lazy.ts).
   * 마우스를 올리거나 탭으로 짚는 순간 미리 받아 둔다.
   */
  prefetch: () => Promise<unknown>
  children: ReactNode
}

/**
 * 헤더 메뉴 한 칸. 지금 보고 있는 화면이면 표시가 붙는다.
 *
 * NavLink는 지금 주소와 맞으면 알아서 표시를 붙여 준다. Link만 쓰던 때는 백테스트 화면에
 * 있어도 헤더의 '주식 백테스트'가 다른 메뉴와 똑같이 생겨서, 화면을 오가는 동안
 * 지금 어디에 있는지 알 방법이 없었다.
 * aria-current="page"도 NavLink가 알아서 붙여 화면을 읽어 주는 도구에도 전해진다.
 *
 * 로고는 이걸 쓰지 않고 아래에서 Link로 직접 그린다. 늘 같은 자리에 있고 '/'로 가는
 * 길이라, 표시를 붙이면 홈에서만 로고 생김새가 달라져 오히려 눈에 걸린다.
 *
 * 짚는 순간 그 화면 묶음을 미리 받는다. 누른 뒤에 받으러 가면 그 시간이 통째로
 * 사용자 앞에 드러난다 — 실측(느린 회선)으로 백테스트가 337ms였다.
 * 화면 묶음은 정적 파일이라 서버에 부담이 없고, 안 눌러도 브라우저 캐시에 남을 뿐이다.
 *
 * onFocus도 같이 거는 건 키보드로 옮겨 다니는 사람에게는 hover가 없어서다.
 * 손가락으로 쓰는 화면에는 둘 다 없지만, 그쪽은 누르기 직전에 pointerdown이 먼저 온다.
 */
function NavItem({ to, prefetch, children }: NavItemProps) {
  /* 실패는 무시한다. 미리받기가 안 되면 누를 때 lazy()가 정상적으로 다시 받는다 */
  const warmUp = () => {
    void prefetch().catch(() => {})
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) => (isActive ? styles.active : '')}
      onMouseEnter={warmUp}
      onFocus={warmUp}
      onPointerDown={warmUp}
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
        <NavItem to="/backtest" prefetch={loadBacktestPage}>
          주식 백테스트
        </NavItem>
        <NavItem to="/ai" prefetch={loadAiPage}>
          AI 주가분석
        </NavItem>
      </nav>

      {/* 심볼은 aria-hidden, 글자 쪽이 'JUBY'라는 이름을 낸다 */}
      <Link to="/" className={styles.logo}>
        <LogoMark className={styles.logoMark} />
        <LogoWord className={styles.logoWord} />
      </Link>

      <nav className={`${styles.menu} ${styles.right}`}>
        <NavItem to="/guide" prefetch={loadGuidePage}>
          사용설명서
        </NavItem>
        {loggedIn ? (
          <NavItem to="/mypage" prefetch={loadMypageLayout}>
            마이페이지
          </NavItem>
        ) : (
          <NavItem to="/login" prefetch={loadLoginPage}>
            로그인
          </NavItem>
        )}
      </nav>
    </header>
  )
}
