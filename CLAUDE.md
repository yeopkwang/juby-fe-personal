# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

프로젝트 소개·실행법·환경변수·코딩 규칙은 [README.md](README.md)에 있다. 먼저 읽는다.
이 문서는 README에 없는 것, 즉 **여러 파일을 읽어야 보이는 구조**만 적는다.

> **2026-09-18: 백엔드가 구현한 API는 전부 연결했다.** 홈·상세·뉴스·백테스트·성향테스트·
> 마이페이지(정보 수정·관심종목)·AI 질문. 실제 브라우저로 검증했다.
> 아직 못 하는 건 **로그인** 하나인데, 이건 백엔드 몫이다(아래 "로그인이 끝까지 이어지지 않는다").
> 로그인이 붙기 전에는 마이페이지·관심종목·AI 질문·성향 저장을 실제로 써 볼 수 없다.

## 명령어

```bash
npm run dev              # 개발 서버 (vite 프록시가 /api 를 백엔드로 넘긴다)
npm run build            # tsc -b 후 vite build
npm run lint             # oxlint
npx tsc -b --noEmit      # 타입만 빠르게 확인
```

**테스트 프레임워크가 없다.** 테스트 러너도 테스트 파일도 없으므로, 변경 검증은
`npm run lint` + `npm run build`(타입 검사 포함) + 브라우저 확인으로 한다.
테스트를 새로 도입하려면 먼저 사용자에게 묻는다.

## 엔트리는 하나다

`index.html` → `src/main.tsx` → `App.tsx`(`BrowserRouter`) 하나뿐이다.

2026-09-21까지는 투자성향테스트만 `personality.html` + `MemoryRouter`로 떨어져 있었다.
로그인·마이페이지가 생겨 본 앱 라우트(`/personality-test`, `/personality-test/result`)로
합치면서 `PersonalityApp.tsx`·`src/personality.tsx`·`personality.html`과
`vite.config.ts`의 `rollupOptions.input`, `Header`의 `standalone` 갈래를 함께 지웠다.
그래서 이제 검사 화면도 뒤로가기·새로고침이 되고, 오갈 때 페이지를 통째로 다시 받지 않는다.

검사 결과는 주소가 아니라 `navigate`의 state로 넘어간다. `/personality-test/result`를
직접 열면 보여줄 게 없어 문항 화면으로 되돌린다(`?from=`은 유지). 들어온 문에 따라
완료 후 돌아갈 곳이 갈린다 — `mypage` → 마이페이지, `ai` → AI, 없으면 홈
(`PersonalityResultPage.doneRoute`).

`App.tsx`의 `path="*"`는 `NotFoundPage`로 간다. 2026-09-21까지는 `NotReadyPage`가
"기능 준비중입니다"라고 답했는데, 머리글 네 항목이 모두 실제 화면으로 이어진 뒤로는
여기 닿는 주소가 오타뿐이라 곧 생길 것처럼 말하는 게 거짓말이 됐다. 만들다 만 화면이
다시 생기면 **그 경로에만** 안내를 붙인다. 한 화면만 쓰던 `ComingSoon`도 함께 접었다.

배포는 **Vercel**이고 설정은 `vercel.json` 하나다(자세한 건 README의 "배포" 절).
규칙 둘의 순서가 중요하다 — `/api/*`를 백엔드로 넘기는 게 먼저, 나머지를 `index.html`로
돌리는 게 나중이다. `/api/*`를 넘기는 건 CORS 때문이 아니라 **사이트는 https인데 백엔드가
http라** 브라우저가 직접 부르면 mixed content로 막히기 때문이다. 그래서 배포에서도
`VITE_API_BASE_URL`은 비워 둔다 — 채우면 그 우회를 건너뛰어 요청이 막힌다.

## API 계층

`src/api/client.ts`가 **`fetch`를 쓰는 유일한 곳**이다(예외: `LoginPage.tsx`의 소셜 로그인
`window.location.href`). 화면 컴포넌트는 `src/api/*.ts`만 부른다.

- `get` / `post` / `patch` / `remove` — 모든 응답이 `{ isSuccess, code, message, result }`
  래퍼라 여기서 벗겨 `result`만 돌려준다. 래퍼 없는 응답은 없다(2026-08-11 통일).
- 실패(4xx/5xx)는 **`ApiError`**(`status`, 서버 `code`, `message`)로 던진다. 화면이
  `error instanceof ApiError && error.code === 'BACKTEST404_5'` 식으로 가려 다른 안내를 낸다.
  네트워크 단절·시간 초과는 그냥 `Error`다.
- JSON이 아닌 본문(게이트웨이 오류 페이지)이 오면 `SyntaxError` 대신 상태코드 문장으로 바꿔 던진다.
- 성공인데 본문이 비었거나 래퍼가 아니면 `ApiError`(code `null`, 고정 문구)다. 화면이 반드시 쓰는
  값이 비어 오면 `src/api/*.ts`가 `malformedResponse()`로 같은 에러를 던진다(백테스트 preset·내 정보·
  종목 목록·종목 상세). 그냥 넘기면 화면이 그리다 `null.필드`에서 던져 **화면 전체**가 오류 화면이 된다.
  한 행의 값이 빈 건 막지 않는다 — 포맷 함수가 "-"로 적는다.

401은 `client.ts`가 전역으로 처리한다(토큰 삭제 후 `/login`으로 이동). 단
① 이미 `/login`이거나 ② 애초에 토큰이 없던 요청이면 이동하지 않는다 — 무한 새로고침과
비로그인 방문자를 끌고 가는 것을 막기 위해서다. 로그아웃처럼 예외가 필요하면
`{ ignoreUnauthorized: true }`를 넘긴다.

`API_DISABLED`(client.ts)는 모든 요청을 끊는 비상 스위치다. 2026-08~09에 증권사 계정 보호로
켜 뒀다가 지금은 꺼져 있다. 다시 켜야 하면 그 한 줄만 바꾼다.

## 증권사(KIS) 호출은 이제 세 곳뿐이다

백엔드가 한국투자증권 API를 중계하는데 호출 제한이 빡빡하다. 2026-09-18에 `/api/stocks/**`로
갈아타면서 **홈 한 번 108건 → 4건**이 됐고, chunk·prefetch·장 열림 탐지·지난 값 저장 같은
장치는 전부 지웠다. 남은 것:

| 어디 | KIS | 왜 |
| --- | --- | --- |
| 홈 표 `GET /api/stocks` | **0회** | DB의 `daily_price`를 읽는다. 종가·등락률·거래대금·`isLiked`·`baseDate` |
| 홈 카드 `GET /api/stocks/{code}?period=ONE_MONTH` ×3 | 3회 | 일봉은 DB, **현재가 하나**를 증권사에 묻는다. `home.ts`가 200ms 간격으로 순차 호출 |
| 상세 `GET /api/stocks/{code}?period=ALL` | 1회 | 같은 이유. **기간 탭은 서버에 다시 묻지 않고** 받아 둔 전체를 화면에서 자른다(`StockChartPage.periodStart`) |

증권사 제한에 걸리면 500이 오고 한 번 더 부르면 대개 된다 — `withRetry`가 그 용도다.
**4xx에는 재시도하지 않는다**(없는 종목을 다시 물어도 없다).

`baseDate`: 16시 배치 전에는 전 거래일, 후에는 당일 종가다. 화면은 "9월 17일 종가 기준"처럼
언제 값인지 함께 적는다. 상세의 현재가만 실시간이고 시·고·저·거래량은 마지막 확정 봉이다.

뉴스 `GET /api/stocks/{code}/news`는 Pinecone이라 증권사와 무관하다. `sort=LATEST|RELEVANCE`,
`page=0~9`(서버 `@Max(9)`), 10건씩.

**`src/api/stockList.ts`(102종목 사본)는 서버 목록이 오기 전 검색용 예비다.** 서버는 100종목을
가나다순으로 주는데 그대로 검색하면 "삼성"에 삼성전자가 후보 밖으로 밀리므로
`byTradingValue()`로 거래대금 순으로 세운 뒤 `searchStocks()`에 넘긴다.

## 날짜는 `YYYYMMDD` 문자열이다

사전순 비교가 곧 날짜순 비교라 코드가 이에 기댄다. **서버는 `YYYY-MM-DD`로 주므로**
`src/api/*`가 받는 자리에서 `fromDashedYmd()`로 바꿔 넣는다. 화면 코드는 하이픈을 모른다.
차트만 `toDashedYmd()`로 되돌려 넘긴다(lightweight-charts가 하이픈 형식을 받는다).

## localStorage 소유권

키를 직접 만지지 말고 아래 두 파일만 거친다.

- `src/utils/auth.ts` — `accessToken` / `refreshToken`. **토큰 접근은 여기서만.**
  (나중에 HttpOnly 쿠키로 옮길 때 이 파일만 고치면 되게 하려는 의도)
- `src/utils/cache.ts` — TTL 있는 임시 캐시(`readCache`/`writeCache`). 읽기·쓰기 실패와
  모양이 다른 값은 전부 "없는 셈" 친다. 지금 쓰는 키: `topStocks`(12h, 홈 카드 첫 그림용)뿐이다.

**두 파일 모두 저장소 접근을 반드시 감싼다.** 브라우저 설정에서 사이트 데이터를 막으면
`window.localStorage`에 **손대는 순간** SecurityError가 난다(메서드가 아니라 속성 접근에서).
`auth.ts`가 이걸 흘려보내면 `isLoggedIn()`이 던지고, 그걸 **렌더 중에** 읽는 `Header`가
그리다 멈춘다 — 머리글은 `ErrorBoundary` 밖이라 오류 화면조차 못 뜨고 **화면이 통째로
하얘진다**(2026-09-22에 실제로 재현했다). 그래서 `auth.ts`는 실패하면 모듈 안의 `Map`에
토큰을 담아 둔다. 새로고침하면 사라지지만 그 탭에서는 로그인해서 쓸 수 있다.
`cache.ts`는 없어도 되는 값이라 담아 두지 않고 그냥 없는 셈 친다.

## 로그인 상태는 구독한다 (2026-09-21)

`auth.ts`가 토큰이 생기거나 사라질 때 구독자에게 알리고, 화면은 `useIsLoggedIn()`
(`src/hooks/`, `useSyncExternalStore`)으로 그 알림을 받는다. 그래서 로그인·탈퇴·토큰 만료에
**페이지를 통째로 새로 받지 않는다.** 예전에는 헤더가 `isLoggedIn()`을 한 번만 읽어서
`window.location.href`로 새로고침하는 수밖에 없었다.

다른 탭에서 로그인·로그아웃하면 `storage` 이벤트로 이 탭도 따라 바뀐다.

주의할 곳 둘:

- **`MypageLayout`은 일부러 구독하지 않는다.** 구독하면 토큰이 사라지는 순간 로그인 화면으로
  밀어내는데, 탈퇴는 홈으로 가야 해서 둘이 싸운다(먼저 그려지는 쪽이 이긴다).
  도중에 토큰이 만료되는 경우는 다음 요청의 401을 `client.ts`가 받아 처리한다.
- **`client.ts`는 컴포넌트가 아니라 `navigate`를 못 쓴다.** `src/utils/navigation.ts`가
  App이 맡겨 둔 navigate를 들고 있다가 `goTo()`로 대신 불러 준다. 맡겨진 게 없으면
  주소창을 통째로 바꾸는 예전 방식으로 물러선다.

## 화면이 죽어도 흰 화면이 안 된다

`App.tsx`가 `<ErrorBoundary resetKey={pathname}>`로 `Suspense`를 감싼다. **머리글은 경계
밖**이라 오류 화면에서도 메뉴로 빠져나갈 수 있고, 경로가 바뀌면 오류 상태가 풀린다
(`getDerivedStateFromProps`. `key`로 갈아끼우면 평소 이동에도 전부 다시 그려진다).

'다시 시도'는 상태를 되돌리지 않고 페이지를 새로 받는다. 여기 걸리는 흔한 경우가
**화면 묶음(lazy)을 못 받은 것**인데, 그건 다시 그려서는 안 풀린다.

받아내는 건 **그리다가** 난 오류뿐이다. 이벤트 처리·비동기·통신 실패는 각 화면 몫이다.

화면 안에는 **구역 경계(`SectionBoundary`)** 가 따로 있다 — 홈 시세표, 종목 상세 가격·차트,
백테스트 결과, 마이페이지 `Outlet` 안쪽. 그 구역만 "이 부분을 표시하지 못했어요 + 다시 시도"로
바뀌고 검색·입력 폼·사이드바·뉴스는 남는다. 다시 시도는 페이지를 새로 받지 않고 그 구역의
데이터를 다시 부른다(`onRetry`). **경계는 자식이 그리다 난 오류만 받아낸다** — 구역의 계산을
경계를 두른 컴포넌트의 렌더에 두면 경계를 지나친다. 종목 상세의 `PriceSection`을 떼어 둔 이유다.

## 탭 제목과 공유 미리보기

화면마다 `useDocumentTitle('이름')`을 부르면 `"이름 - JUBY"`가 된다. 종목 상세만 종목명을
넣는다. 떠날 때 되돌리지 않으므로 **제목을 안 정한 화면은 앞 화면 제목을 물려받는다.**

카카오톡·슬랙 미리보기(og 태그)는 `index.html`에 **한 벌뿐**이고 화면별로 바꿀 수 없다.
크롤러가 자바스크립트를 실행하지 않기 때문이다. 종목별 미리보기를 하려면 서버 렌더링이 필요하다.
`og:image`는 절대주소여야 해서 배포 도메인이 정해진 뒤에 채운다.

## 로그인이 끝까지 이어지지 않는다 (백엔드 미구현)

2026-09-18 확인. `OAuth2SuccessHandler`가 발급한 토큰을 **응답 본문 JSON으로 쓰고 끝난다.**
프론트 `/oauth/callback?accessToken=…`으로 리다이렉트하지 않으므로 `OAuthCallbackPage`는
도달할 수 없고, 소셜 로그인을 누르면 백엔드 도메인에 JSON이 그대로 뜬다.

`POST /api/auth/reissue`·`/logout`도 **컨트롤러가 없다**(작업 보드는 "진행 중").
`api/auth.ts`의 logout은 보드 경로를 적어 두고 실패를 삼키는 상태다.

백엔드에 요청할 것: 성공 핸들러에서 `{FRONT_ORIGIN}/oauth/callback?accessToken=&refreshToken=`
으로 리다이렉트. 그게 붙는 순간 프론트는 고칠 것 없이 동작한다.

인증 범위(SecurityConfig): `/api/backtest/**`·`/api/stocks/**`·`/api/personality-tests`만 공개.
나머지 `/api/**`는 토큰이 없거나 만료면 `CustomEntryPoint`가 **제대로 된 401**을 준다.
예외: `/api/personality-tests`는 permitAll이라 **POST를 토큰 없이 부르면 NPE로 500**이다.
그래서 `personality.ts`는 로그인했을 때만 POST하고 아니면 프론트에서 채점한다.

## 아직 mock인 곳

- `src/api/ai.ts` — **질문(`ask`)만 실제** `POST /api/open-ai/ask`. 대화방 목록·상세는 mock이다.
  백엔드 `/api/chat-sessions` 5종이 진행 중이라 붙일 곳이 없다. 새 대화의 sessionId·title은
  화면이 지어낸다. 성향 없는 회원의 질문은 서버가 404(MEMBER404_2)로 거절하므로 화면이
  성향테스트로 안내한다.
- `src/api/guide.ts` — 백엔드에 설명서 API도 테이블도 없다.
- `src/api/personality.ts`의 `MOCK_QUESTIONS`(7문항) — **비로그인 상태에서 서버가 죽었을 때만** 쓴다.
  화면이 "임시 문항으로 진행 중"이라고 알린다. 로그인 상태면 물러서지 않고 실패 안내 + 다시 시도를
  보여준다 — 로그인 결과는 서버에 저장되므로 예비 문항 점수가 회원 성향으로 남으면 안 된다.
  정식 문항은 DB에 10개(보기 5개, 1·3·5·7·9점)가 있고 합계 10~90이 서버 채점 구간과 맞는다.
  mock으로 물러선 경우엔 합이 그 구간에 못 미쳐 `normalizeScore()`로 늘린다.
- `PATCH /api/members/me/personality`는 `personalityId`(DB 행 id)를 받는데 프론트가 그 id를
  알 길이 없어 안 붙였다. 성향은 성향테스트 POST로 바꾼다.

프론트에 하드코딩된 데이터: `home.ts`의 `TOP_THEMES` 3개(테마 라벨과 종목은 API에 없다).

## 백엔드 코드에서 확인한 백테스트 특성

`src/utils/backtest.ts`의 표(전략·최소 기간·가중치)는 전부 JUBY-BE 소스에서 옮긴 값이다.

- 성향 → 전략은 **1:1**이다(`BacktestService`의 `switch(investType)`). 요청에 전략 필드가 없다.
- 축별 점수(안정성·수익성·효율성·성장성)를 서버가 **응답에 안 담는다**(로그로만 찍음).
  `calculateAxisScores()`가 원시 지표로 되계산한다. 서버가 주기 시작하면 지운다.
- `/preset/options`는 종목과 무관한 전역 목록이라 특정 종목엔 없을 수 있다 → `BACKTEST404_5`.
  화면은 "아직 계산되지 않은 조합"으로 안내한다.
- 거래가 0건이면 MDD·변동성이 0이라 안정성이 100점이 된다. 화면이 `거래횟수 0회` 경고를 먼저 띄운다.

## 잔가지

- 스타일은 CSS Modules(`*.module.css`). 색상은 `src/index.css`의 CSS 변수를 쓴다.
  등락 색은 한국식이다 — 상승 빨강, 하락 파랑(README 참고).
- 차트 라이브러리는 `lightweight-charts` 하나뿐이고 종목 상세의 캔들에만 쓴다. 이 라이브러리는
  차트 안에 TradingView 링크(`a[target=_blank]`)를 넣는다 — 뉴스 카드를 셀 때 섞이지 않게 한다.
  홈 카드의 작은 그래프는 `CardChart.tsx`가 SVG로 직접 그린다(2026-09-21에 recharts를 걷어냈다.
  압축 97KB짜리를 선 세 줄에 쓰고 있었다). 크기는 `ResizeObserver`로 재서 실제 픽셀로 그린다 —
  viewBox로 늘리면 카드가 넓을수록 선 굵기와 끝점 동그라미까지 같이 늘어난다.
- `logout()`은 화면 이동을 하지 않는다. 부르는 쪽이 `navigate`로 갈 곳을 정한다. 부르는 곳은
  마이페이지 사이드바의 로그아웃 버튼 하나뿐이고 홈으로 보낸다. 머리글에 두지 않은 이유는
  좁은 폭에서 오른쪽이 이미 꽉 차서다. 서버 요청은 3초만 기다린다 — 실패해도 토큰은 지우므로
  결과가 같은데 기본 12초를 기다리면 나가는 길만 막힌다.
- **늦게 온 응답이 새 화면을 덮지 않게 하는 방식은 하나로 맞춘다.** effect 안에 `isStale`을
  두고 `.then`·`.catch` **안에서** 확인한다(`NewsList`, `StockChartPage`). 정리 함수는 이미
  나간 요청을 취소하지 못하고 표시만 남긴다. 요청을 *거는* 쪽을 감싸는 건 의미가 없다 —
  그 자리는 effect에서 곧바로 실행돼 검사 시점에 늘 false다(2026-09-21에 그런 코드를 걷어냈다).
  다시 부르는 버튼은 콜백을 직접 부르지 말고 `retryCount` 같은 상태를 올려 effect를 다시 돌린다.
- `Modal`은 열릴 때 body 스크롤을 잠그고 포커스를 **상자 자체**에 준다(`tabIndex={-1}`).
  첫 버튼이 아닌 이유는 탈퇴 모달의 첫 버튼이 '탈퇴하기'라서다. 탭은 상자 안에서 돌고,
  닫으면 열었던 버튼으로 포커스가 돌아간다. 이름은 `label` prop(`aria-label`)로 받는다.
  **`onClose`는 effect 의존성에 넣지 않는다**(ref에 담아 둔다) — 부르는 세 곳 모두 렌더마다
  새 함수를 넘겨서, 넣으면 글자 하나 칠 때마다 포커스가 입력칸에서 상자로 튕긴다.
- 낙관적 갱신(하트·관심종목 해제)은 먼저 바꾸고 실패하면 되돌린다. 진행 중인 종목은 ref의
  Set으로 막아 연타를 걸러낸다.
- **서버가 주는 자유 글을 그리는 자리에는 `overflow-wrap: anywhere`를 준다.** 이메일이나
  긴 주소처럼 띄어쓰기 없는 덩어리는 끊을 곳이 없어 320px에서 상자를 밀어내고 페이지 전체가
  가로로 스크롤된다(2026-09-21에 마이페이지 이메일·뉴스 제목에서 실제로 났다).
  말줄임표나 줄 수 제한으로 잘라내는 자리는 이미 안전하다.
