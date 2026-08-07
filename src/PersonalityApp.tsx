import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import PersonalityTestPage from './pages/PersonalityTestPage'
import PersonalityResultPage from './pages/PersonalityResultPage'
import styles from './PersonalityApp.module.css'

/**
 * 투자성향테스트만 띄우는 별도 페이지(personality.html)의 뿌리.
 * 로그인이 붙기 전까지는 홈·상세 화면과 섞이지 않게 따로 둔다.
 *
 * MemoryRouter를 쓰는 이유:
 * 이 페이지의 주소는 언제나 /personality.html이고 그 뒤에 경로를 더 붙일 수 없다.
 * 붙여봐야 새로고침하는 순간 서버가 그런 파일을 못 찾는다.
 * 그래서 화면 이동은 주소창을 건드리지 않고 기억해두는 것으로만 처리한다.
 * 결과 화면은 원래도 새로고침하면 사라지므로(결과를 주소가 아니라 state로 넘긴다) 잃는 게 없다.
 *
 * 두 화면의 경로 이름은 본 앱에 있던 것과 똑같이 뒀다.
 * 나중에 다시 합칠 때 이 파일과 personality.html만 지우면 되게 하기 위해서다.
 */
export default function PersonalityApp() {
  /* ?from=mypage 같은 진입 정보는 주소창에 있으므로 라우터 첫 자리에 그대로 실어준다 */
  const entry = `/personality-test${window.location.search}`

  return (
    <MemoryRouter initialEntries={[entry]}>
      <div className={styles.page}>
        <Routes>
          <Route path="/personality-test" element={<PersonalityTestPage />} />
          <Route
            path="/personality-test/result"
            element={<PersonalityResultPage />}
          />
          <Route path="*" element={<Navigate to={entry} replace />} />
        </Routes>
      </div>
    </MemoryRouter>
  )
}
