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

    /* 저장하는 순간 헤더도 알게 된다(utils/auth.ts가 알려준다) */
    saveTokens(accessToken, refreshToken)

    /*
     * 예전에는 여기서 주소창을 통째로 바꿔 페이지를 새로 받았다. 헤더가 그려질 때
     * 로그인 여부를 한 번 읽고 마는 구조라, 그렇게 하지 않으면 로그인한 뒤에도
     * 우측이 '로그인'으로 남았기 때문이다.
     *
     * 이제 헤더가 상태를 지켜보므로 그럴 필요가 없다. navigate로 넘기면 화면이
     * 하얗게 번쩍이지 않고, 받아둔 시세·캔들 캐시도 그대로 남는다.
     *
     * replace라서 뒤로 가기를 눌러도 이 콜백 주소로 돌아오지 않는다.
     * 토큰이 붙은 주소라 방문 기록에 남겨 둘 이유도 없다.
     */
    navigate('/', { replace: true })
  }, [searchParams, navigate])

  return <p className={styles.message}>로그인 중</p>
}
