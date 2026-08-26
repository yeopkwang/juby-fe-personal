import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { warmStockDetail } from './api/warmup'
import './index.css'
import App from './App.tsx'

/*
 * React를 켜기 **전에** 데이터를 부르러 보낸다.
 *
 * 어느 화면인지는 주소만 봐도 안다. 라우터가 판단할 때까지 기다릴 이유가 없고,
 * 그 기다림이 실측 346ms였다(자세한 숫자는 api/warmup.ts).
 *
 * 빌드가 심는 묶음 미리받기(plugins/route-preload.ts)와 짝이다. 그쪽은 **파일**을
 * 당기고 이쪽은 **데이터**를 당긴다. 둘 다 "주소만 보면 안다"는 같은 사실에 기댄다.
 *
 * 지금은 종목 상세 하나뿐이다. 다른 화면들은 들어가자마자 부를 것이 없거나
 * (로그인·사용설명서) 로그인 여부에 따라 달라져서, 여기서 미리 부르면 헛것이 된다.
 */
/*
 * ⚠️ 통째로 try로 감싼다. 여기는 createRoot **앞**이라 던지면 React가 아예 안 켜지고
 * ErrorBoundary도 없다 — 부팅 점 세 개만 남은 흰 화면이 된다.
 *
 * 실제로 던지는 길이 있다. 주소창에 `/stocks/%E0%A4%A`처럼 깨진 퍼센트 인코딩을
 * 넣으면 decodeURIComponent가 URIError를 던진다. 그런 주소는 어차피 없는 종목이라
 * 화면은 '목록에 없는 종목입니다'를 띄우면 그만인데, 그 화면조차 못 뜨게 된다.
 *
 * 미리 부르기는 **빨리 하자는 것뿐**이라 실패하면 그냥 안 하면 된다.
 */
try {
  const detailPath = /^\/stocks\/([^/]+)\/?$/.exec(window.location.pathname)
  if (detailPath !== null) warmStockDetail(decodeURIComponent(detailPath[1]))
} catch {
  /* 미리 못 불렀을 뿐이다. 화면이 들어가서 정상적으로 다시 부른다 */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
