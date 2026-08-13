import { useLocation } from 'react-router-dom'
import styles from './LoginPage.module.css'

/**
 * OAuth 이동만은 Vite 프록시를 타지 않고 백엔드 주소로 곧장 나간다.
 * 그래서 client.ts의 baseURL과 별개인 환경변수를 쓴다.
 */
const API_ORIGIN: string =
  import.meta.env.VITE_API_ORIGIN ?? 'http://3.35.191.42:8080'

const PROVIDERS = [
  {
    id: 'naver',
    name: '네이버',
    icon: '/social/naver.svg',
    className: `${styles.social} ${styles.naver}`,
  },
  {
    id: 'kakao',
    name: '카카오',
    icon: '/social/kakao.svg',
    className: `${styles.social} ${styles.kakao}`,
  },
  {
    id: 'google',
    name: '구글',
    icon: '/social/google.svg',
    className: `${styles.social} ${styles.google}`,
  },
]

export default function LoginPage() {
  /*
   * 콜백 페이지가 토큰을 못 받으면 이 state를 달아 되돌려보낸다.
   * 주소에 안 붙으므로 헤더의 '로그인'으로 새로 들어오면 안내가 따라오지 않는다.
   * (새로고침은 브라우저가 state를 들고 있어서 그대로 남는다)
   */
  const location = useLocation()
  const state = location.state as { loginFailed?: boolean } | null
  const hasLoginFailed = state?.loginFailed === true

  /**
   * ⚠️ fetch·axios를 쓰면 안 된다. **주소창을 통째로 옮기는 것이 맞다.**
   *
   * 이 주소는 백엔드가 302로 네이버·카카오·구글 로그인 화면에 넘겨주는 자리다.
   * 사용자가 그 화면을 눈으로 보고 아이디를 입력해야 하는데, fetch는 배경에서 도는
   * 통신이라 화면을 옮기지 못한다. 응답으로 302를 받아 봐야 아무 일도 일어나지 않는다.
   *
   * 이 함수는 client.ts의 허용 목록 판단을 지나지 않는다. 창구가 다르다.
   * 여기 적힌 주소를 늘릴 일이 생기면 client.ts가 아니라 이 파일을 봐야 한다.
   *
   * ⚠️ **돌아오는 길이 아직 안 이어져 있다** (2026-08-14 백엔드 소스 확인).
   *
   * 나가는 길은 살아 있다. 세 provider 모두 302로 네이버·카카오·구글 로그인 화면에
   * 제대로 넘긴다. 문제는 로그인을 마친 뒤다.
   *
   * 백엔드 `OAuth2SuccessHandler`가 **주소를 옮기지 않고 JSON을 그려 버린다.**
   * `objectMapper.writeValue(response.getOutputStream(), ...)` 한 줄이 전부라,
   * 사용자는 앱으로 돌아오지 못하고 백엔드 주소에서 이런 화면을 마주한다.
   *
   *   {"isSuccess":true,...,"result":{"accessToken":"ey...","refreshToken":"ey..."}}
   *
   * 백엔드가 `sendRedirect`로 우리 `/oauth/callback?accessToken=..&refreshToken=..`에
   * 되돌려보내 주면 그때부터 저절로 이어진다. **프론트는 이미 다 준비돼 있다** —
   * OAuthCallbackPage가 토큰을 꺼내 저장하고 헤더까지 갱신하는 것을 확인했다.
   *
   * 그때까지 손으로 확인하는 법: 위 JSON 화면에서 두 토큰을 복사해
   * `/oauth/callback?accessToken=붙여넣기&refreshToken=붙여넣기`로 직접 들어간다.
   */
  function handleSocialLogin(provider: string) {
    window.location.href = `${API_ORIGIN}/oauth2/authorization/${provider}`
  }

  return (
    <>
      <div className={styles.titleBar}>
        <h1 className={styles.title}>로그인</h1>
      </div>

      <div className={styles.body}>
        <div className={styles.band}>
          <h2 className={styles.headline}>
            초보자를 위한 주식 비서,
            <br />
            JUBY의 세계로!
          </h2>

          <p className={styles.caption}>Create Your Own JUBY!</p>

          {hasLoginFailed && (
            <p className={styles.error} role="alert">
              로그인에 실패했습니다. 다시 시도해주세요.
            </p>
          )}

          <div className={styles.buttons}>
            {PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className={provider.className}
                onClick={() => handleSocialLogin(provider.id)}
                aria-label={`${provider.name} 계정으로 로그인`}
              >
                <img
                  className={styles.icon}
                  src={provider.icon}
                  alt=""
                  width={22}
                  height={22}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
