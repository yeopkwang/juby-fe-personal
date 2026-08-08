# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

프로젝트 소개·실행법·환경변수·코딩 규칙은 [README.md](README.md)에 있다. 먼저 읽는다.
이 문서는 README에 없는 것, 즉 **여러 파일을 읽어야 보이는 구조**만 적는다.

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

## 엔트리가 두 개다

| 엔트리 | 뿌리 | 라우터 |
| --- | --- | --- |
| `index.html` → `src/main.tsx` | `App.tsx` | `BrowserRouter` |
| `personality.html` → `src/personality.tsx` | `PersonalityApp.tsx` | `MemoryRouter` |

`vite.config.ts`의 `rollupOptions.input`에 둘 다 적혀 있다. **엔트리를 추가하면 여기도 고쳐야
빌드에 포함된다.** 투자성향테스트가 `MemoryRouter`인 이유는 주소가 항상 `/personality.html`로
고정이라 하위 경로를 붙이면 새로고침 시 404가 나기 때문이다.

로그인·마이페이지가 생기면 `PersonalityApp.tsx`와 `personality.html`을 지우고 본 앱 라우트로
합치는 게 원래 계획이다. 그래서 두 앱의 경로 이름(`/personality-test`)을 일부러 맞춰 뒀다.

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

## 백엔드 미완성 구간 토글

`src/api/personality.ts` 상단의 `USE_BACKEND_QUESTIONS` / `USE_BACKEND_SUBMIT`가 **둘 다 false**다.
백엔드 `personality_test`·`choices` 테이블이 비어 있어서다. `MOCK_QUESTIONS`(7문항)를 쓰고
채점도 프론트에서 한다. 문항 데이터가 들어오면 조회부터 켜고, 제출은 로그인이 필요하니 나중에 켠다.
mock은 실제 API 응답과 같은 모양이라 플래그만 바꾸면 화면 코드는 그대로다.

프론트에 하드코딩된 다른 데이터: `src/api/stockList.ts`의 102종목, `home.ts`의 `TOP_THEMES` 3개.

## 잔가지

- 날짜는 전부 **`YYYYMMDD` 문자열**이다. 사전순 비교가 곧 날짜순 비교라 코드가 이에 기댄다.
  변환은 `src/utils/date.ts`만 쓴다(차트는 `toDashedYmd`로 하이픈 형식이 필요).
- 스타일은 CSS Modules(`*.module.css`). 색상은 `src/index.css`의 CSS 변수를 쓴다.
  등락 색은 한국식이다 — 상승 빨강, 하락 파랑(README 참고).
- 차트 라이브러리가 둘이다. 상세 캔들은 `lightweight-charts`, 홈 카드 스파크라인은 `recharts`.
- `logout()`은 화면 이동을 하지 않는다. `Header`가 `isLoggedIn()`을 한 번만 읽으므로
  부르는 쪽에서 `window.location.href = '/'`로 통째로 새로고침해야 상태가 갱신된다.
