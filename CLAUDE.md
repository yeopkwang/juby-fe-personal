# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

프로젝트 소개·실행법·환경변수·코딩 규칙은 [README.md](README.md)에 있다. 먼저 읽는다.
이 문서는 README에 없는 것, 즉 **여러 파일을 읽어야 보이는 구조**만 적는다.

> 📌 **[docs/handoff-2026-08-21.md](docs/handoff-2026-08-21.md)를 같이 읽는다.**
> 이 문서가 *코드가 어떻게 생겼는지*를 적는다면, 그쪽은 **사용자가 정한 규칙(하지 말 것,
> 손대지 말 것, 말투)과 지금 어디까지 왔는지**를 적는다. 코드만 봐서는 안 보이는 것들이다.

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

### 라우트가 **세 곳**에 적혀 있다 (2026-08-26)

한 화면을 옮기거나 주소를 바꾸면 아래 셋을 같이 본다. 일부러 나눠 둔 것이라
합칠 생각을 하기 전에 각자의 이유를 먼저 읽는다.

| 어디 | 무엇을 적나 | 안 고치면 |
| --- | --- | --- |
| `src/App.tsx` | 주소 → 화면. 진짜 라우트는 여기 하나다 | 화면이 안 뜬다 |
| `src/pages/lazy.ts` | 묶음을 받아오는 함수. `lazy()`와 미리받기가 **같은 함수**를 써야 같은 묶음이 된다 | 같은 파일을 두 번 내려받는다 |
| `vite.config.ts`의 `routePreload` | 주소 → 그 화면에 필요한 파일들 | **그 주소만 조용히 느려진다** |

세 번째만 손으로 옮겨 적은 표라 어긋날 수 있는데, 어긋나는 방향이 안전한 쪽이다.
파일 이름이 틀리면 **빌드가 실패하고**(`plugins/route-preload.ts`가 던진다), 주소가
틀리면 미리 못 받을 뿐 화면은 멀쩡하다. 그래서 라우트를 데이터로 바꾸는 큰 공사를
하지 않았다.

미리받기가 두 겹인 이유: `lazy.ts` 쪽은 **앱 안에서 옮겨 다닐 때**(홈이 한가할 때
상세를 받아 둠, 헤더에 마우스를 올리면 그 화면을 받아 둠) 쓰고, `routePreload`는
**주소를 직접 치고 들어왔을 때** 쓴다. 후자는 앱이 아직 없어서 JS로 못 한다 —
그래서 빌드가 `<head>`에 심는 script가 대신 한다.

### 탭 제목은 화면이 단다

`index.html`의 `<title>JUBY</title>`는 **React가 오기 전까지의 제목**이다.
화면마다의 제목은 `src/hooks/useDocumentTitle.ts`를 부른다. 모든 라우트가 부르기로
약속돼 있고(`path="*"`까지), 그 약속 때문에 훅에 되돌리는 뒷정리가 없다.
새 라우트를 만들면 한 줄을 같이 넣는다.

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

## 실패를 다루는 층 (2026-08-20에 만듦)

**던지는 쪽과 보여주는 쪽 사이에 `src/utils/error.ts`가 있다.** 화면이 `error.message`를
그대로 그리면 개발자용 문구("허용 목록에 없는 경로입니다 …")가 사용자에게 뜬다.
실제로 그런 자리가 여러 곳 있었다.

`client.ts`가 실패를 **네 종류로 갈라서** 던진다(`ApiError`도 여기 있다 — `client.ts`에
두면 순환 참조가 된다).

| 클래스 | 언제 |
| --- | --- |
| `BlockedPathError` | 허용 목록에 없는 경로. **fetch에 닿기 전에** 끊긴 것 |
| `NoResponseError` | 타임아웃·네트워크 단절·차단기 열림 |
| `ApiError` | 서버가 4xx/5xx로 답함. `status`·`code`를 들고 있다 |
| `UserFacingError` | `isSuccess: false`의 서버 `message`. 그대로 보여줘도 되는 문장 |

화면은 이 둘만 부른다.

- `toUserMessage(error, notFound?)` — 사용자에게 보일 한 문장. 종목 상세는
  `'목록에 없는 종목입니다'`처럼 404 문구를 자기 것으로 갈아 끼운다.
- `isRetryable(error)` — **곧바로 다시 불러서 결과가 달라질 수 있는가.**
  `BlockedPathError`와 404는 false다. 두 곳이 쓴다 — 화면은 '다시 시도' 버튼을 그릴지에
  (눌러도 결과가 같은 자리에 버튼을 두면 사용자는 자기 인터넷을 의심하며 계속 누른다),
  `utils/async.ts`의 `withRetry`는 쉬었다 다시 부를지에 쓴다.

⚠️ **`settleInChunks`는 이걸 쓰지 않는다.** 그쪽이 묻는 건 "**남은 것들도** 소용없는가"라
질문이 다르다. 404는 종목 하나가 없다는 뜻이지 다음 종목도 없다는 뜻이 아니라서,
경로가 막힌 경우(`BlockedPathError`)만 따로 본다.

붙는 곳은 `LoadFailure` 하나다(홈 카드·상세 차트·뉴스가 같이 쓴다). `onRetry`를 안 넘기면
버튼 자체를 안 그린다.

⚠️ **중간에서 실패를 새 에러로 갈아 끼우면 종류가 지워진다.** `home.ts`의
`loadTopStocks()`가 `lastError`를 붙들었다가 그대로 다시 던지는 이유가 이것이다.
뭉뚱그리면 `isRetryable`이 판단할 근거를 잃는다.

**흰 화면 방지는 따로다.** `App.tsx`의 `ErrorBoundary`가 `<main>` 안쪽만 감싼다
(헤더는 살아남는다). `resetKey={pathname}` — 주소가 바뀌면 접힌 걸 편다. `key`를 쓰지
않은 이유는 종목을 바꿀 때마다 `CandleChart`가 통째로 다시 만들어지기 때문이다.
**이 앱의 유일한 클래스 컴포넌트다**(React가 `getDerivedStateFromError`를 클래스로만 준다).
그리는 중의 오류만 잡는다 — 이벤트 핸들러와 `.catch()`한 프라미스는 안 걸린다.

## 이 코드베이스의 성격을 결정하는 제약: KIS 호출 제한

백엔드가 한국투자증권 API를 중계하는데 호출 제한이 빡빡하고 일부는 느리다.
`src/utils/async.ts`, `src/api/candles.ts`, `src/api/home.ts`의 복잡도는 **전부 여기서 나왔다.**
실측값이 주석에 적혀 있으니 숫자를 바꾸기 전에 반드시 읽는다.

- 현재가 `/api/market/price` — 실전 서버, 종목당 ~56ms. 하지만 **종목당 1회 호출**이라
  102종목을 몰아치면 60개가 500으로 떨어진다. → `settleInChunks(5개씩, 120ms 간격)` + `withRetry`
- 일봉 — 예전에는 `/api/market/daily_itemchartprice`(모의투자 서버 중계, 건당 1.5~2.4초)를
  써서 캐시·hover 미리받기로 버텼다. **2026-08-19에 상세 화면이 `GET /api/stocks/{code}`로
  옮겨가면서 이 창구를 지웠다.** 지금 `candles.ts`에 남은 것은 홈 카드용
  `loadRecentCandles()`(실전 서버, 30~90ms) 하나뿐이다.

`shouldStop` 콜백은 "화면을 떠났는가"를 묻는다. 떠난 뒤에도 도는 요청이 다음 화면 요청을
뒤로 밀어내기 때문에, 긴 루프를 새로 만들면 이 패턴을 따른다.

**`daily_price`를 읽는 API가 생겼다** (`GET /api/stocks/{code}`, 2026-08-19). 예고대로
`candles.ts`의 12시간 캐시와 `prefetchCandles`는 읽는 쪽이 없어져 지웠다. `quoteSnapshot.ts`는
아직 홈이 쓴다 — 홈은 여전히 `/api/market/price`에 매여 있기 때문이다.
`home.ts`의 `getHomeStocks()`도 `GET /v1/home`이 생기면 시세까지 담아 반환하도록 바꾸는 게
예정된 방향이다.

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
| `/api/backtest**` | 백테스트 (프리셋·기간 옵션. **둘 다 GET이다**) |
| `/api/personality-tests` | 투자성향테스트 (문항 조회·결과 제출) |
| `/api/members/me**` | 마이페이지 (정보·성향 조회/수정/탈퇴) |
| `/api/stocks/**` | 종목 상세 (OHLCV 조회·종목별 뉴스. **둘 다 GET이다**) |

**막는 목록이 아니라 허용 목록인 것이 핵심이다.** 막는 목록은 빠뜨리면 그 경로가 조용히
뚫리지만, 허용 목록은 빠뜨려도 안 나갈 뿐이다. 새 API를 붙이면서 여기 적는 걸 잊으면
화면이 바로 실패하니 눈에 띈다. 잘못될 방향이 안전한 쪽인 구조를 고른 것이다.

나가지 못하는 것들과 그 이유:

| 경로 | 왜 |
| --- | --- |
| `/api/market/**` | **증권사(KIS) 중계.** 홈 한 번이 108건이라 계정 정지 경고를 받았다 |
| `/api/token`, `/api/initiate` | 마찬가지로 KIS를 부른다. 프론트는 원래 안 쓴다 |
| `/api/news` | 네이버 검색 중계라 관련도 정렬이 없었다. 종목 뉴스는 `/api/stocks/{code}/news`로 옮겼다 |
| `/api/open-ai/ask`, `/v1/ai/**` | AI 표에 행이 하나도 없다 |
| `/api/guides` | 노션에서 확인하지 못했다 |
| `/v1/auth/logout` | 인증 API. 프론트가 건드리지 않기로 했다 |

**KIS 경로는 노션에 완료로 있어도 적으면 안 된다.** 증권사 계정 문제는 명세와 별개의
사정이라, 백엔드가 다 만들었어도 부르지 않는 것이 맞다.

> ⚠️ **다만 기준은 "KIS를 거치는가"가 아니라 "몰아치는가"다.** `/api/stocks/{code}`는
> 백엔드에서 KIS 현재가를 **1건** 부르지만 허용했다. 계정 경고를 부른 것은 KIS를 거친다는
> 사실 자체가 아니라 **홈이 102종목을 한 번에 몰아쳐 108건을 만든 것**이었기 때문이다.
> 상세는 사용자가 종목 하나를 열 때 1건이고, 오히려 이 창구로 옮기면서 상세의 KIS 호출이
> 2건(현재가+일봉)에서 **1건으로 줄었다.** `/api/market/**`이 계속 막혀 있는 이유는
> 그 경로가 KIS라서가 아니라 **홈이 그걸 102번 부르기 때문**이다.

(백엔드에서 `domain/kis` 패키지를 쓰는 곳을 전수 확인했다 — market·token·**stock**이고
backtest·openai·news·personality_test·member는 참조가 0건이다.)

같은 목록이 `vite.config.ts`의 `server.proxy`에 한 번 더 적혀 있다. 두 번째 자물쇠라
일부러 나눠 뒀으니 **바꿀 때 같이 바꾼다.** `/v1`은 통로 자체를 뚫지 않았다.

`src/pages/LoginPage.tsx`의 소셜 로그인 이동은 이 판단을 지나지 않는다. fetch가 아니라
주소창을 통째로 옮기는 것이라 창구가 다르다. **이건 막혀 있지 않다** — 아래 참고.

호출부를 하나씩 주석 처리하지 않은 이유는 `client.ts`의 fetch가 **앱 전체에서 유일한 통신
창구**이기 때문이다(전수 확인함). 창구에서 가르면 빠뜨릴 곳이 없고 새로 추가되는 코드까지
자동으로 걸린다.

### 지금 화면이 어떻게 보이는지 (2026-08-19 브라우저 확인)

| 화면 | 상태 |
| --- | --- |
| 투자성향테스트 | **10문항이 실제로 뜬다.** 백엔드 DB에 문항이 들어왔다 |
| 백테스트 | 전략 목록이 실제로 뜬다 |
| **종목 상세** | 차트·시세는 실제로 뜬다. **뉴스는 2026-08-25 현재 백엔드가 502다** |
| 홈 | 종목명·코드는 뜨고 시세는 `-`. **고장이 아니라 KIS 차단 때문이다** |
| AI·사용설명서 | 각자의 에러/빈 화면. 허용 목록에 없다 |
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
**일곱 개 전부 붙어 있다.** 마지막 하나(성향 직접 변경)는 2026-08-20에 붙였는데
번호를 추정으로 쓰고 있다 — 아래 '성향 직접 변경' 참고.

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

### 성향 직접 변경: 번호가 **추정값**이다 (2026-08-20)

`PATCH /api/members/me/personality`는 이름이 아니라 **`personalityId`(숫자)** 를 받는데,
**다섯 성향의 번호 전체를 주는 API가 없다.** 알려주는 창구가 검사 결과 하나뿐이다.

그래서 `utils/personality.ts`의 `PERSONALITY_IDS`에 `InvestPersonality` enum 순서대로
1~5를 적어 뒀다(백엔드 `PersonalityErrorCode`가 "1 ~ 5 사이"라고 말하는 것이 근거).
**이건 추정이다.** 번호가 어긋나면 엉뚱한 성향이 저장되는데 화면에는 성공으로 보인다 —
그게 이걸 오래 안 붙이고 있던 이유였다.

그래서 **바꾼 뒤 반드시 다시 조회해서 서버가 실제로 저장한 이름을 보여준다.**
고른 것과 다르면 그 자리에 경고가 뜬다. 조용히 틀리는 것만은 막아 둔 구조다.

> 📮 **백엔드에 물어볼 것:** `SELECT id, invest_personality FROM personality;`
> 답을 받으면 `PERSONALITY_IDS`만 고치면 된다. 다른 곳은 손댈 필요 없다.

### 명세와 백엔드 코드가 다른 곳 (코드가 맞다)

| 노션 | 백엔드 코드 |
| --- | --- |
| `POST /api/personality-test` | `/api/personality-tests` (**복수**) |
| `discription` | `description` (조회·제출 응답 양쪽) |
| 내 정보에 `socialType` 없음 | 실제로는 준다. 화면이 안 써서 타입에서 뺐다 |
| 성향 조회에 `personalityImg` 없음 | 실제로는 준다. 그림으로 쓴다 |

**백엔드 소스(`JUBYInvest/JUBY-BE`)를 읽어 확인한 것.** 다시 파지 않아도 되게 적어 둔다.

- 문항을 넣는 코드가 **백엔드 어디에도 없다.** 누가 DB에 직접 넣지 않으면 비어 있고,
  그때 서버는 **200에 빈 배열**을 준다. 성공으로 처리하면 문항을 그리다 터진다.
  `getQuestions()`가 빈 목록을 실패로 던지는 이유다.
  (2026-08-20에 `ErrorBoundary`가 생겨 흰 화면까지 가지는 않는다. 그래도 이 방어는
  남긴다 — 잡아서 오류 화면을 띄우는 것보다 애초에 실패로 다루는 쪽이 문구가 정확하다.)
- 백엔드 `InvestPersonality` enum이 프론트 `PersonalityType`과 **정확히 같다**.
- `getQuestions()`가 `findAll()`을 **정렬 없이** 부른다. `sortByIds()`는 실제로 필요한 방어다.
- SecurityConfig의 허용 목록에 **`/api/**`가 통째로 `permitAll`**이다. 문항 조회는 비로그인도 된다.
  대신 로그인이 필요한 것들은 `@AuthenticationPrincipal`에서 곧바로 id를 꺼내므로
  **토큰 없이 부르면 401이 아니라 NPE로 500**이 난다. 마이페이지·성향 화면이 401 대신
  500을 다루는 이유가 이것이다.

프론트에 하드코딩된 다른 데이터: `src/api/stockList.ts`의 102종목, `home.ts`의 `TOP_THEMES` 3개.

## 백테스트: 창구가 `GET /preset` 하나다 (2026-08-14 정리)

**`POST /api/backtest`는 없다. 다시 붙이지 않는다.**

| 확인한 것 | 결과 |
| --- | --- |
| `POST /api/backtest` | 404 |
| `POST /api/backtest/run` | 404 |
| dev의 `BacktestController` 매핑 전수 | `GET /preset`, `GET /preset/options` **둘뿐** |

배포가 밀린 게 아니라 경로 자체가 없다. 예전엔 `deploy/37` 브랜치에 있었지만 그 브랜치는
dev보다 59개 뒤처져 있고 앞선 커밋이 0개다 — 합쳐지길 기다리는 게 아니라 걷어내진 것이다.

**화면이 보여주는 숫자는 원래부터 전부 프리셋에서 나왔다.** 한때 실행을 따로 부르고 그
원시 지표를 결과 아래(`RunFigures`)에 덧붙였는데, 그 여섯 칸(누적수익률·연평균·샤프·
최대낙폭·변동성·거래횟수)이 **프리셋 응답에 이미 전부 들어 있어** 같은 값을 두 번 그리는
꼴이었다. 게다가 두 창구는 단위가 달라서(프리셋 **소수** 0.39 = 39%, 실행은 ta4j
`NetReturnCriterion`의 **배수** 1.39 = 39%) 섞이면 100배씩 어긋났다. 지금은 한 창구뿐이라
그 위험이 사라졌다 — **수익률·낙폭·변동성은 모두 소수이고 `toPercent()` 하나로 처리한다.**

프리셋 `result`의 생김새(실측):

```
stable  { mdd, volatility, dVolatility }
profit  { totalReturn, annualReturn, avgTradeReturn }
effect  { sharpeRatio, sortinoRatio, calmarRatio }
growth  { momentumRatio, volGrowthRatio, positionCount }
```

**연평균 수익률은 프리셋에는 제대로 온다**(`profit.annualReturn`). 누적과 다른 값이다.
(예전에 "아직 계산되지 않는다"고 적힌 건 실행 쪽 `annualizedReturn` 이야기였다.
백엔드 `AnalysisCriterionConverter`가 누적을 두 번 담던 그것 — 이제 무관하다.)

`period` 열거값은 **복수형**이다: `ONE_MONTH`, `THREE_MONTHS`, `SIX_MONTHS`, `ONE_YEAR`.
단수로 보내면 400이 온다. 성향마다 적재된 기간이 달라(안정형 4개, 위험중립형 2개)
`getPresetOptions()`나 `supportedPeriods()`로 거른 뒤 부른다.

지웠지만 다시 필요해질 수 있는 값 — 백엔드 전략 빈 이름은 넷뿐이었다:
`rsiReversionStrategy`(안정형) / `bollingerBandStrategy`(안정추구형) /
`smaStrategy`(위험중립형). MACD·돌파는 짝이 없었다. 프리셋은 전략 이름이 아니라
`investType` 하나로 정해지므로 지금은 이 이름들이 어디에도 필요 없다.

## 종목 상세: `GET /api/stocks/**` 둘 (2026-08-19 연결)

`StockController` 매핑은 둘뿐이다 — `GET /{stockCode}`, `GET /{stockCode}/news`.
**둘의 성격이 다르니 같이 묶어 생각하지 않는다.**

| | 데이터 출처 | KIS |
| --- | --- | --- |
| `/{stockCode}` | OHLCV는 백엔드 **DB(daily_price)**, 현재가·전일대비만 KIS | **1건** |
| `/{stockCode}/news` | **Pinecone(벡터DB)** | 없음 |

이 창구로 옮기면서 상세 화면의 KIS 호출이 **2건 → 1건**으로 줄었다. 없어진 쪽이 하필
`daily_itemchartprice`(모의투자 서버, 건당 1.5~2.4초)라 체감도 크게 바뀐다.

### ⚠️ `period` 열거값이 백테스트와 다르다

```
종목 상세   ONE_WEEK ONE_MONTH THREE_MONTH  SIX_MONTH  ONE_YEAR THREE_YEAR ALL   ← 단수
백테스트                       THREE_MONTHS SIX_MONTHS ONE_YEAR                  ← 복수
```

같은 백엔드인데 enum이 둘로 갈려 있다(`domain/stock/enums/Period` vs 백테스트 쪽).
**복사해 쓰면 400이 온다.** 안 보내면 기본값이 `ALL`(2025-01-02부터, 약 400건)이라
화면이 쓰는 기간을 반드시 명시한다.

### 뉴스: 정렬을 화면에서 하지 않는다

`sort=LATEST|RELEVANCE`를 서버가 받는다. 탭을 누르면 그 순서로 **다시 물어본다.**
관련도는 Pinecone 벡터 유사도라 애초에 프론트가 흉내 낼 수 있는 값이 아니다.
(예전에 `/api/news`가 sort를 무시해서 관련도순 탭에 '준비중입니다'를 띄워 뒀었다.
그 가림막은 걷어냈다.)

후보 100건을 10건씩 준다 — **`page`는 0~9**이고 넘기면 400이다(`@Min(0) @Max(9)`).
`title`·`description`에 HTML 태그도 엔티티도 섞여 오지 않는다(확인함). `stripHtml`이 필요 없다.
`timeAgo`("2시간 전")를 백엔드가 계산해서 주므로 화면은 그대로 쓴다.
언론사명은 없어서 `originalLink` 도메인으로 대신한다.

### 아직 남은 것: 장 시작 전 `전일 대비 0.00%`

`comparePrev`는 KIS에서 오는 값이라 **장이 열리기 전에는 0.0**이고, 그때 `currentPrice`는
전일 종가와 같다(2026-08-19 08:57에 실측 — 268,500원 / 0.0, 전일 종가 268,500원).
홈은 `quoteSnapshot`으로 이미 다루지만 상세는 그대로다.

시·고·저·**종**·거래량 **다섯 칸**은 이 문제에서 벗어났다. 예전에는 KIS 현재가 응답에서
꺼내 써서 장 전에 통째로 `-`였는데, 지금은 `dailyPrices`의 **마지막 확정 거래일** 값을 쓴다.
오늘 것이 아니므로 "8월 18일 장 기준"을 함께 적는다.

다섯을 **한 줄에 세운다**(`grid-template-columns: repeat(5, 1fr)`). 종가만 색을 안 입힌다 —
그 표는 '지난 장'이고, 색은 위쪽 현재가 영역이 맡는다. 폭이 줄면 5 → 3 → 2칸으로 접히는데
그 경계(1040 / 660 / 440px)는 눈대중이 아니라 **320~1600px를 1px씩 훑어서** 넘침이
없는 지점으로 잡은 값이다. 칸을 늘리거나 글자를 키우면 다시 훑어야 한다.
(`dailyPrices`에는 오늘 봉이 아예 안 들어온다 — 확정된 것만 적재된다. `dropUnsettled` 불필요.)

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
