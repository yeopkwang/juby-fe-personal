# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

프로젝트 소개·실행법·환경변수·코딩 규칙은 [README.md](README.md)에 있다. 먼저 읽는다.
이 문서는 README에 없는 것, 즉 **여러 파일을 읽어야 보이는 구조**만 적는다.

> **⚠️ `docs/handoff-2026-08-09.md`는 오래됐다.** 그 문서의 API 표는 스웨거를 보고 적은
> 것인데, 지금은 **팀 노션만 근거로 삼는다.** 백테스트 화면은 그 뒤 브라우저로 확인했다.
> 아래 '허용 목록' 절이 지금 상태다. 충돌하면 이 문서가 맞다.

## 명령어

```bash
npm run dev              # 개발 서버
npm run build            # tsc -b 후 vite build (두 엔트리 모두)
npm run lint             # oxlint
npx tsc -b --noEmit      # 타입만 빠르게 확인
```

**테스트 프레임워크가 없다.** 테스트 러너도 테스트 파일도 없으므로, 변경 검증은
`npm run lint` + `npm run build`(타입 검사 포함) + 브라우저 확인으로 한다.
테스트를 새로 도입하려면 먼저 사용자에게 묻는다.

## 엔트리는 하나다 (2026-08-12에 합침)

`index.html` → `src/main.tsx` → `App.tsx` / `BrowserRouter`. 이게 전부다.

**예전에는 두 개였다.** 투자성향테스트가 `personality.html`이라는 별도 페이지에 떨어져 있었고
`MemoryRouter`를 썼다. 주소가 항상 `/personality.html`로 고정이라 하위 경로를 붙이면
새로고침 때 404가 났기 때문이다. 로그인이 붙으면 합치기로 하고 그때부터 경로 이름
(`/personality-test`)을 일부러 맞춰 뒀는데, 그 덕에 합칠 때 **라우트 두 줄만 옮기고 화면
코드는 한 줄도 고치지 않았다.**

이 흔적이 남아 있으면 지워도 된다: `PersonalityApp.tsx`, `src/personality.tsx`,
`personality.html`, `Header`의 `standalone` 프로퍼티, `a href="/personality.html"` 링크.

`App.tsx`의 `path="*"`는 `NotReadyPage`로 간다. 미구현 화면은 전부 여기로 떨어진다.

## API 계층

`src/api/client.ts`가 **`fetch`를 쓰는 유일한 곳**이다(예외: `LoginPage.tsx`의 소셜 로그인
`window.location.href`). 응답 형태가 두 가지라 함수도 두 개다.

- `get<T>()` / `post<T>()` — `{ isSuccess, code, message, result }` 래퍼를 벗겨 `result`만 반환.
  `isSuccess: false`면 서버 `message`로 throw.
- `getRaw<T>()` — MarketController 계열(`/api/market/**`). 래퍼 없이 데이터가 그대로 온다.

401은 `client.ts`가 전역으로 처리한다(토큰 삭제 후 `/login`으로 이동). 단
① 이미 `/login`이거나 ② 애초에 토큰이 없던 요청이면 이동하지 않는다 — 무한 새로고침과
비로그인 방문자를 끌고 가는 것을 막기 위해서다. 로그아웃처럼 예외가 필요하면
`{ ignoreUnauthorized: true }`를 넘긴다.

## 이 코드베이스의 성격을 결정하는 제약: KIS 호출 제한

백엔드가 한국투자증권 API를 중계하는데 호출 제한이 빡빡하고 일부는 느리다.
`src/utils/async.ts`, `src/api/candles.ts`, `src/api/home.ts`의 복잡도는 **전부 여기서 나왔다.**
실측값이 주석에 적혀 있으니 숫자를 바꾸기 전에 반드시 읽는다.

- 현재가 `/api/market/price` — 실전 서버, 종목당 ~56ms. 하지만 **종목당 1회 호출**이라
  102종목을 몰아치면 60개가 500으로 떨어진다. → `settleInChunks(5개씩, 120ms 간격)` + `withRetry`
- 일봉 `/api/market/daily_itemchartprice` — **모의투자 서버 중계라 건당 1.5~2.4초.**
  → `loadCandles()`가 `inFlight` Map으로 동시 중복 요청을 합치고, 목록에서 hover 시
  `prefetchCandles()`로 미리 받는다. 홈 카드도 상세와 **같은 창구**를 써서 캐시를 공유한다.

`shouldStop` 콜백은 "화면을 떠났는가"를 묻는다. 떠난 뒤에도 도는 요청이 다음 화면 요청을
뒤로 밀어내기 때문에, 긴 루프를 새로 만들면 이 패턴을 따른다.

**백엔드에 `daily_price` 테이블을 읽는 API가 생기면** `candles.ts`의 캐시·prefetch와
`quoteSnapshot.ts`는 통째로 필요 없어진다. `home.ts`의 `getHomeStocks()`도
`GET /v1/home`이 생기면 시세까지 담아 반환하도록 바꾸는 게 예정된 방향이다.

## 장 시간 처리

증권사 현재가 API는 "오늘 장" 기준이라 **장 시작 전·마감 후·주말에는 등락률과 거래량이
0으로 초기화되어 온다.** 그대로 그리면 표 전체가 `0.00% / -`가 된다. 그래서:

- `hasSessionData()` — **시가(`stck_oprc`) > 0**으로 장 개시를 판정한다. 시각(09:00 등)으로
  판단하지 않는 이유는 휴장·임시휴장·조기폐장에 전부 어긋나기 때문이다.
- 오늘 값이 하나도 없으면 `quoteSnapshot.ts`에 저장해 둔 마지막 정규장 값을 대신 보여주고,
  `frozenDate`로 어느 장 기준인지 화면에 함께 적는다.
- `dropUnsettled()` — 아직 안 끝난 오늘 봉은 잘라낸다. 미확정 종가라 새로고침마다 차트가
  움직이기 때문이다.

## localStorage 소유권

키를 직접 만지지 말고 아래 두 파일만 거친다.

- `src/utils/auth.ts` — `accessToken` / `refreshToken`. **토큰 접근은 여기서만.**
  (나중에 HttpOnly 쿠키로 옮길 때 이 파일만 고치면 되게 하려는 의도)
- `src/utils/cache.ts` — TTL 있는 임시 캐시(`readCache`/`writeCache`). 읽기·쓰기 실패는
  전부 삼키고 "없는 셈" 친다. 키: `candles:<종목코드>`(12h), `topStocks`(12h), `quoteSnapshot`(7d)

## ⛔ 허용 목록에 적힌 경로만 나갈 수 있다

**명세의 근거는 팀 노션 한 곳이다. 스웨거를 보고 붙이지 않는다.**
스웨거에는 아직 개발 중인 것까지 다 올라와 있어서, 그걸 보고 붙였다가 백엔드가 만들지도
않은 API를 부른 적이 있다. 노션에 '완료'로 찍힌 것만 부른다.

`src/api/client.ts`의 `ALLOWED_PREFIXES`가 그 목록이고, **여기 없으면 요청이 fetch에 닿기
전에 끊긴다.** 지금 셋뿐이다.

| 나갈 수 있는 것 | 화면 |
| --- | --- |
| `/api/backtest**` | 백테스트 (실행·프리셋·기간 옵션) |
| `/api/personality-tests` | 투자성향테스트 (문항 조회·결과 제출) |
| `/api/members/me**` | 마이페이지 (정보·성향 조회/수정/탈퇴) |

**막는 목록이 아니라 허용 목록인 것이 핵심이다.** 막는 목록은 빠뜨리면 그 경로가 조용히
뚫리지만, 허용 목록은 빠뜨려도 안 나갈 뿐이다. 새 API를 붙이면서 여기 적는 걸 잊으면
화면이 바로 실패하니 눈에 띈다. 잘못될 방향이 안전한 쪽인 구조를 고른 것이다.

나가지 못하는 것들과 그 이유:

| 경로 | 왜 |
| --- | --- |
| `/api/market/**` | **증권사(KIS) 중계.** 홈 한 번이 108건이라 계정 정지 경고를 받았다 |
| `/api/token`, `/api/initiate` | 마찬가지로 KIS를 부른다. 프론트는 원래 안 쓴다 |
| `/api/news` | 노션 어느 표에도 없다 |
| `/api/open-ai/ask`, `/v1/ai/**` | AI 표에 행이 하나도 없다 |
| `/api/guides` | 노션에서 확인하지 못했다 |
| `/v1/auth/logout` | 인증 API. 프론트가 건드리지 않기로 했다 |

**KIS 경로는 노션에 완료로 있어도 적으면 안 된다.** 증권사 계정 문제는 명세와 별개의
사정이라, 백엔드가 다 만들었어도 부르지 않는 것이 맞다.
(백엔드에서 `domain/kis` 패키지를 쓰는 곳을 전수 확인했다 — market·token뿐이고
backtest·openai·news·personality_test·member는 참조가 0건이다.)

같은 목록이 `vite.config.ts`의 `server.proxy`에 한 번 더 적혀 있다. 두 번째 자물쇠라
일부러 나눠 뒀으니 **바꿀 때 같이 바꾼다.** `/v1`은 통로 자체를 뚫지 않았다.

`src/pages/LoginPage.tsx`의 소셜 로그인 이동은 이 판단을 지나지 않는다. fetch가 아니라
주소창을 통째로 옮기는 것이라 창구가 다르다. **이건 막혀 있지 않다** — 아래 참고.

호출부를 하나씩 주석 처리하지 않은 이유는 `client.ts`의 fetch가 **앱 전체에서 유일한 통신
창구**이기 때문이다(전수 확인함). 창구에서 가르면 빠뜨릴 곳이 없고 새로 추가되는 코드까지
자동으로 걸린다.

### 지금 화면이 어떻게 보이는지 (2026-08-12 브라우저 확인)

| 화면 | 상태 |
| --- | --- |
| 투자성향테스트 | **10문항이 실제로 뜬다.** 백엔드 DB에 문항이 들어왔다 |
| 백테스트 | 전략 목록이 실제로 뜬다 |
| 홈 | 종목명·코드는 뜨고 시세는 `-`. **고장이 아니라 KIS 차단 때문이다** |
| 상세·AI·뉴스·사용설명서 | 각자의 에러/빈 화면. 허용 목록에 없다 |
| 마이페이지 | 토큰이 있으면 요청은 나간다 |

## 로그인: 나가는 길만 이어져 있다 (2026-08-14)

세 provider 모두 백엔드가 302로 제대로 넘긴다(확인함). 문제는 **돌아오는 길**이다.

백엔드 `OAuth2SuccessHandler`가 주소를 옮기지 않고 **JSON을 그려 버린다.**
`objectMapper.writeValue(response.getOutputStream(), ...)`가 전부라, 로그인을 마친
사용자는 앱으로 못 돌아오고 백엔드 주소에서 이런 화면을 본다.

```
{"isSuccess":true,...,"result":{"accessToken":"ey...","refreshToken":"ey..."}}
```

백엔드가 `sendRedirect`로 `/oauth/callback?accessToken=..&refreshToken=..`에
되돌려보내 주면 그때부터 저절로 이어진다. **프론트는 이미 다 돼 있다** —
가짜 토큰으로 콜백을 찔러 토큰 저장·헤더 갱신·마이페이지 진입·로그아웃 축출까지 확인했다.

손으로 확인하려면 위 JSON에서 토큰을 복사해
`/oauth/callback?accessToken=붙여넣기&refreshToken=붙여넣기`로 직접 들어간다.

⚠️ **신규 가입은 구글·카카오가 500이 난다.** `GoogleResponse`/`KakaoResponse`의
`getBirthyear()`·`getBirthday()`가 `null`이 아니라 **문자열 `"null"`**을 돌려준다.
`parseBirth()`는 진짜 `null`만 걸러내므로 `LocalDate.parse("null-null")`까지 가서
터진다. 기존 회원은 무사하다(조회에서 끝나 이 줄에 안 닿는다).

## 투자성향테스트 · 마이페이지

명세는 팀 노션의 7개(회원 조회/수정/탈퇴, 성향 조회/변경, 문항 조회, 결과 제출)뿐이다.
**전부 붙어 있다. 하나만 빼고** — 아래 '못 붙인 하나' 참고.

### 채점은 서버가 한다. 단, 비로그인은 화면이 대신 매긴다

제출(`POST /api/personality-tests`)은 **고른 보기의 점수 10개를 낱개 그대로** 보낸다
(`{ "scores": [3,1,7,...] }`). 서버가 합산해 성향을 정하고 **회원에게 저장까지 한다**
(`member.updatePersonality`).

문제는 이 API가 로그인을 요구한다는 것이다. 토큰 없이 부르면 401이 아니라 **500**이라,
그대로 두면 문항 10개를 다 푼 사람이 마지막에 원인 모를 오류를 만난다.
그래서 **비로그인은 `utils/personality.ts`의 `scoreToPersonality()`로 화면에서 매긴다.**
구간이 서버와 같은 값이라 결과도 같고, 다른 점은 저장되지 않는다는 것뿐이다.
그 사실은 결과의 `saved`로 화면이 말해 준다.

> ⚠️ **구간이 두 곳에 있다.** 백엔드 `PersonalityTestService`가 기준을 바꾸면
> `scoreToPersonality()`도 같이 바꿔야 한다. 안 그러면 로그인 여부에 따라 같은 답에서
> 다른 성향이 나온다. 지금 값: 10~14 안정형 / 15~34 안정추구형 / 35~54 위험중립형 /
> 55~74 적극투자형 / 75~90 공격투자형.

예전에는 `USE_BACKEND_QUESTIONS`·`USE_BACKEND_SUBMIT` 토글과 7문항짜리
`MOCK_QUESTIONS`, 그리고 점수를 하나로 환산하는 `normalizeScore()`가 있었다.
환산은 문항이 7개뿐이던 시절 합계가 서버 유효 구간(10~90) 아래로 떨어져 500이 나는 걸
피하려던 것이다. **문항 10개 × 배점 1·3·5·7·9라 합계가 정확히 10~90이 되면서 전부 필요
없어져 지웠다.** 이 이름들이 보이면 남은 흔적이다.

### 못 붙인 하나: 성향 직접 변경

`PATCH /api/members/me/personality`는 이름이 아니라 **`personalityId`(숫자)** 를 받는데,
그 번호를 알려주는 창구가 **검사 결과 하나뿐이다.** 다섯 성향의 번호 전체를 주는 API가 없다.
창구(`changeMyPersonality`)는 만들어 뒀지만 **화면에 '직접 고르기'를 붙이지 않았다** —
번호를 지어내면 사용자의 성향이 엉뚱하게 바뀌는데 화면에는 성공으로 보인다.
번호 표를 받으면 그때 붙인다.

### 명세와 백엔드 코드가 다른 곳 (코드가 맞다)

| 노션 | 백엔드 코드 |
| --- | --- |
| `POST /api/personality-test` | `/api/personality-tests` (**복수**) |
| `discription` | `description` (조회·제출 응답 양쪽) |
| 내 정보에 `socialType` 없음 | 실제로는 준다. 화면이 안 써서 타입에서 뺐다 |
| 성향 조회에 `personalityImg` 없음 | 실제로는 준다. 그림으로 쓴다 |

**백엔드 소스(`JUBYInvest/JUBY-BE`)를 읽어 확인한 것.** 다시 파지 않아도 되게 적어 둔다.

- 문항을 넣는 코드가 **백엔드 어디에도 없다.** 누가 DB에 직접 넣지 않으면 비어 있고,
  그때 서버는 **200에 빈 배열**을 준다. 성공으로 처리하면 화면이 터지는데 이 앱에는
  ErrorBoundary가 없어 흰 화면이 된다. `getQuestions()`가 빈 목록을 실패로 던지는 이유다.
- 백엔드 `InvestPersonality` enum이 프론트 `PersonalityType`과 **정확히 같다**.
- `getQuestions()`가 `findAll()`을 **정렬 없이** 부른다. `sortByIds()`는 실제로 필요한 방어다.
- SecurityConfig의 허용 목록에 **`/api/**`가 통째로 `permitAll`**이다. 문항 조회는 비로그인도 된다.
  대신 로그인이 필요한 것들은 `@AuthenticationPrincipal`에서 곧바로 id를 꺼내므로
  **토큰 없이 부르면 401이 아니라 NPE로 500**이 난다. 마이페이지·성향 화면이 401 대신
  500을 다루는 이유가 이것이다.

프론트에 하드코딩된 다른 데이터: `src/api/stockList.ts`의 102종목, `home.ts`의 `TOP_THEMES` 3개.

## 백테스트: 같은 화면에 단위가 두 가지다

한 화면인데 두 API의 숫자 규약이 다르다. 섞으면 100배씩 어긋난다.

| | 어디서 | 수익률이 오는 꼴 |
| --- | --- | --- |
| 프리셋 `GET /preset` | 새벽 배치가 미리 계산 | **소수.** 0.1856 = 18.56% → `toPercent()` |
| 실행 `POST /api/backtest` | 서버가 그 자리에서 계산 | **배수.** 1.0이 본전, 2.04 = +104% |

배수인 이유는 백엔드가 ta4j 0.22.3의 `new NetReturnCriterion()`을 인자 없이 부르기
때문이다. 그 기본 표현이 `ReturnRepresentationPolicy`에서 MULTIPLICATIVE다(소스 확인).
그래서 화면은 1을 빼고 100을 곱한다 — 그냥 100을 곱하면 본전이 100% 번 것으로 보인다.
최대낙폭은 배수가 아니라 원래 비율이라 양쪽 다 `toPercent()`가 맞다.

**연평균 수익률은 아직 없다.** 백엔드 `AnalysisCriterionConverter`가
`List.of(totalReturn, totalReturn, ...)`으로 누적을 두 번 담는다
(`// 연평균 수익률 추후 추가` 주석이 그대로 있다). 화면은 누적과 값이 다를 때만
그 칸을 넣으므로, 백엔드가 진짜로 계산하기 시작하면 저절로 나타난다.

**실행 엔드포인트는 아직 배포되지 않았다**(2026-08-14 기준 404). 백엔드 소스에서도
`deploy/37` 브랜치에만 있고 dev·main에는 없으며, 그 브랜치의 경로는 `/api/backtest/run`,
응답에 성향 두 필드가 없다. 실패해도 프리셋 결과는 그대로 뜨게 해 뒀다.

전략 이름(`strategyKey`)은 백엔드 전략 빈이 넷뿐이라 **다섯 중 셋만 이어져 있다.**
MACD와 돌파는 짝이 없어 `null`이고, 그 전략을 고르면 실행을 부르지 않는다.

## 잔가지

- 날짜는 전부 **`YYYYMMDD` 문자열**이다. 사전순 비교가 곧 날짜순 비교라 코드가 이에 기댄다.
  변환은 `src/utils/date.ts`만 쓴다(차트는 `toDashedYmd`로 하이픈 형식이 필요).
- 스타일은 CSS Modules(`*.module.css`). 색상은 `src/index.css`의 CSS 변수를 쓴다.
  등락 색은 한국식이다 — 상승 빨강, 하락 파랑(README 참고).
- 차트 라이브러리는 `lightweight-charts` 하나다(종목 상세 캔들). 홈 카드 스파크라인은
  `CardChart.tsx`가 **SVG를 직접 그린다.** 예전엔 여기에 `recharts`를 썼는데 카드 세 장
  때문에 gzip 100KB가 더 들어와서 걷어냈다(지금 0.9KB). 상세 쪽으로 합치지 않은 이유는
  그건 축·눈금·마우스 조작이 딸린 본격 차트라 눈금도 없는 작은 그림에는 더 번거롭기 때문이다.
- **로그인 상태는 전역이다.** `useIsLoggedIn()`(`src/hooks/`)을 쓰면 토큰이 생기거나
  사라질 때 화면이 알아서 다시 그려진다. `utils/auth.ts`가 `saveTokens`/`clearTokens`에서
  직접 알림을 낸다(localStorage는 스스로 알려주지 않는다). 다른 탭의 변화도 `storage`
  이벤트로 따라온다.
  → 예전엔 헤더가 `isLoggedIn()`을 한 번만 읽어서, 로그인·로그아웃 뒤에 화면을 통째로
  새로고침(`window.location.href = '/'`)해야 우측 메뉴가 바뀌었다. **그 코드가 보이면
  남은 흔적이다.** 이벤트 핸들러 안에서 그 순간의 값을 읽는 경우(홈의 하트 클릭)는
  `isLoggedIn()`을 그대로 부르는 게 맞다.
