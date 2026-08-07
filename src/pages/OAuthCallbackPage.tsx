import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { saveTokens } from '../utils/auth'
import styles from './OAuthCallbackPage.module.css'

/**
 * 소셜 로그인을 마친 백엔드가 토큰을 주소 뒤에 달아 되돌려보내는 자리.
 * 사용자에게 보여줄 화면이 아니라 토큰을 옮겨 담고 바로 떠나는 중간 지점이다.
 */
export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const accessToken = searchParams.get('accessToken')
    const refreshToken = searchParams.get('refreshToken')

    if (accessToken === null || refreshToken === null) {
      // replace를 주면 뒤로 가기로 이 빈 콜백에 다시 돌아오지 않는다
      navigate('/login', { replace: true, state: { loginFailed: true } })
      return
    }

    saveTokens(accessToken, refreshToken)

    /*
     * navigate가 아니라 주소창을 통째로 바꾼다.
     * 헤더는 그려질 때 isLoggedIn()을 한 번 읽을 뿐이라 navigate로는 다시 읽지 않아
     * 로그인 직후에도 우측이 '로그인'으로 남는다. 전체 새로고침이면 헤더도 새로 읽는다.
     * 전역 상태를 만들면 없앨 수 있는 임시 방편이다.
     */
    window.location.href = '/'
  }, [searchParams, navigate])

  return <p className={styles.message}>로그인 중</p>
}
