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

`App.tsx`의 `path="*"`는 `NotReadyPage`로 간다. 미구현 화면은 전부 여기로 떨어진다.

**배포할 때는 없는 경로를 `index.html`로 돌려주도록** 정적 호스팅을 설정해야 한다.
안 하면 `/backtest` 같은 주소에서 새로고침할 때 404가 난다.

## API 계층

`src/api/client.ts`가 **`fetch`를 쓰는 유일한 곳**이다(예외: `LoginPage.tsx`의 소셜 로그인
`window.location.href`). 화면 컴포넌트는 `src/api/*.ts`만 부른다.

- `get` / `post` / `patch` / `remove` — 모든 응답이 `{ isSuccess, code, message, result }`
  래퍼라 여기서 벗겨 `result`만 돌려준다. 래퍼 없는 응답은 없다(2026-08-11 통일).
- 실패(4xx/5xx)는 **`ApiError`**(`status`, 서버 `code`, `message`)로 던진다. 화면이
  `error instanceof ApiError && error.code === 'BACKTEST404_5'` 식으로 가려 다른 안내를 낸다.
  네트워크 단절·시간 초과는 그냥 `Error`다.
- JSON이 아닌 본문(게이트웨이 오류 페이지)이 오면 `SyntaxError` 대신 상태코드 문장으로 바꿔 던진다.

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
- `src/api/personality.ts`의 `MOCK_QUESTIONS`(7문항) — **서버가 죽었을 때만** 쓴다.
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
- 차트 라이브러리가 둘이다. 상세 캔들은 `lightweight-charts`, 홈 카드 스파크라인은 `recharts`.
  lightweight-charts는 차트 안에 TradingView 링크(`a[target=_blank]`)를 넣는다 — 뉴스 카드를
  셀 때 이것이 섞이지 않게 한다.
- `logout()`은 화면 이동을 하지 않는다. `Header`가 `isLoggedIn()`을 한 번만 읽으므로
  부르는 쪽에서 `window.location.href = '/'`로 통째로 새로고침해야 상태가 갱신된다.
- 낙관적 갱신(하트·관심종목 해제)은 먼저 바꾸고 실패하면 되돌린다. 진행 중인 종목은 ref의
  Set으로 막아 연타를 걸러낸다.
