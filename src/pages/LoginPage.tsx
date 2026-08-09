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

  /*
   * fetch를 쓰면 안 된다. 이 주소는 백엔드가 302로 네이버·카카오·구글 로그인 화면에
   * 넘겨주는 자리이고, 사용자가 그 화면을 직접 보고 아이디를 입력해야 한다.
   * fetch는 배경에서 도는 통신이라 화면을 옮기지 못하므로 주소창 자체를 이동시킨다.
   *
   * ⛔ 지금은 막아 뒀다.
   * client.ts의 API_DISABLED와 같은 이유다 — 증권사 계정 보호. 이 이동은 fetch가 아니라
   * 주소창을 백엔드로 옮기는 것이라 client.ts의 스위치가 잡지 못해 여기서 따로 막는다.
   * 되돌릴 때는 아래 주석을 풀고 그 윗줄(alert)을 지운다.
   */
  function handleSocialLogin(provider: string) {
    alert('백엔드 호출을 막아 둔 상태라 로그인을 진행할 수 없습니다.')
    console.warn(
      `[차단됨] 원래 이동할 주소: ${API_ORIGIN}/oauth2/authorization/${provider}`,
    )
    // window.location.href = `${API_ORIGIN}/oauth2/authorization/${provider}`
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
