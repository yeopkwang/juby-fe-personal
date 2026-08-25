/**
 * 화면 묶음을 받아오는 함수들.
 *
 * App.tsx의 `lazy()`가 쓰고, 미리 받고 싶은 쪽(홈·헤더)도 **같은 함수**를 쓴다.
 * 이 파일이 있는 이유가 그것이다 — 경로 문자열을 두 곳에 적으면 한쪽만 고쳤을 때
 * 같은 파일이 서로 다른 두 묶음으로 갈라져 두 번 내려받는다.
 *
 * 미리 받는 것은 그냥 이 함수를 부르는 것이다. 모듈은 한 번만 실제로 받아지고
 * 두 번째부터는 같은 약속(Promise)이 돌아오므로, 나중에 `lazy()`가 불러도
 * 다시 받지 않는다. 실패해도 그때 `lazy()`가 정상적으로 다시 시도한다.
 *
 * 여기 값을 넣거나 다른 모듈을 import하지 않는다. 미리받기 한 줄 때문에 첫 묶음이
 * 무거워지면 안 된다. 지금은 함수 선언뿐이라 무게가 사실상 없다.
 */

export const loadStockChartPage = () => import('./StockChartPage')
export const loadAiPage = () => import('./AiPage')
export const loadLoginPage = () => import('./LoginPage')
export const loadOAuthCallbackPage = () => import('./OAuthCallbackPage')
export const loadMypageLayout = () => import('../components/MypageLayout')
export const loadMypagePersonalityPage = () => import('./MypagePersonalityPage')
export const loadMypageProfilePage = () => import('./MypageProfilePage')
export const loadGuidePage = () => import('./GuidePage')
export const loadBacktestPage = () => import('./BacktestPage')
export const loadPersonalityTestPage = () => import('./PersonalityTestPage')
export const loadPersonalityResultPage = () => import('./PersonalityResultPage')
export const loadNotReadyPage = () => import('./NotReadyPage')
