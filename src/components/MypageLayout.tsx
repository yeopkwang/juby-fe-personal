import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { isLoggedIn } from '../utils/auth'
import styles from './MypageLayout.module.css'

const MENU = [
  { to: '/mypage/personality', label: '투자유형 보기' },
  { to: '/mypage/profile', label: '내 정보 확인' },
]

/**
 * 마이페이지 두 화면이 함께 쓰는 껍데기. 사이드바 + 오른쪽 내용(Outlet).
 *
 * 사이드바 생김새는 AI 주가분석 화면과 거의 같지만 컴포넌트를 공용화하지 않았다.
 * 그쪽 목록은 서버에서 오는 대화 세션이라 개수가 계속 변하고, 이쪽은 고정 두 개에
 * 현재 경로로 선택을 판단한다. 억지로 합치면 양쪽 조건이 한 파일에 뒤엉킨다.
 */
export default function MypageLayout() {
  /*
   * 세 경로 모두 로그인이 필요하다. 렌더 전에 막아야 아래 화면들이
   * 토큰 없이 API를 부르고 실패 화면을 잠깐 보여주는 일이 없다.
   */
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />
  }

  return (
    <>
      <h1 className={styles.title}>마이페이지</h1>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.head}>
            <h2 className={styles.headTitle}>마이페이지</h2>
          </div>

          <ul className={styles.list}>
            {MENU.map((item) => (
              <li key={item.to}>
                {/* NavLink가 현재 경로를 알아서 판단한다 */}
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    isActive ? `${styles.item} ${styles.itemOn}` : styles.item
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </aside>

        <section className={styles.content}>
          <Outlet />
        </section>
      </div>
    </>
  )
}
