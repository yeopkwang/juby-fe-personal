# JUBY 프론트엔드

주식 백테스트 · AI 주가분석 서비스 JUBY의 웹 화면.
React 19 + TypeScript + Vite, 시장 데이터는 전부 JUBY-BE(Spring Boot)를 거친다.

## 시작하기

```bash
npm install
cp .env.example .env   # 값은 그대로 둬도 된다
npm run dev
```

개발 환경: Node 24 / npm 11

## 화면 주소

**시작 파일은 `index.html` 하나다.** 아래는 전부 그 안의 라우트다.

| 주소 | 내용 |
| --- | --- |
| `/` | 홈 (테마 카드 + 종목 시세표) |
| `/stocks/:종목코드` | 종목 상세 (일봉 차트 · 시세 · 뉴스) |
| `/backtest` | 주식 백테스트 |
| `/ai` | AI 주가분석 |
| `/personality-test` · `/personality-test/result` | 투자성향 테스트 |
| `/mypage/personality` · `/mypage/profile` | 마이페이지 |
| `/guide` | 사용설명서 |
| `/login` · `/oauth/callback` | 로그인 |
| 그 밖 | `NotReadyPage` (준비 중) |

투자성향 테스트는 2026-08-12까지 `personality.html`이라는 **별도 페이지**였다.
지금은 본 앱 라우트로 합쳤다. `?from=mypage` / `?from=ai`를 붙이면 검사를 마친 뒤
그쪽으로 돌아간다.

## 명령어

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 후 빌드 |
| `npm run lint` | oxlint |
| `npm run check:css` | `styles.X`를 부르는데 CSS에 정의가 없는 곳 찾기 |
| `npm run preview` | 빌드 결과 확인 (개발 프록시를 물려받는다) |

**테스트 러너가 없다.** 변경 검증은 위 네 개 + 브라우저 확인으로 한다.

## 백엔드 연결

`.env`의 `VITE_API_BASE_URL`을 비워두면 `vite.config.ts`의 프록시를 타서 `/api` 요청이
백엔드로 넘어간다. 개발 중에는 비워두는 편이 CORS를 안 겪는다.

⚠️ **`/api`라고 다 나가는 것은 아니다.** 허용 목록에 적힌 네 갈래만 나간다
(`/api/backtest`, `/api/personality-tests`, `/api/members/me`, `/api/stocks`).
증권사(KIS)를 몰아치는 경로를 막으려고 일부러 그렇게 뒀고, 목록은 `src/api/client.ts`와
`vite.config.ts` **두 곳에 나뉘어** 있다. 이유와 바꾸는 법은 `CLAUDE.md`에 있다.
`/v1`은 통로 자체를 뚫지 않았다.

`VITE_API_ORIGIN`은 소셜 로그인 이동에만 쓴다.
브라우저 주소창이 직접 찾아가는 곳이라 프록시를 탈 수 없어 절대주소가 필요하다.

## 규칙

- 증권사(KIS) API를 프론트에서 직접 부르지 않는다. 반드시 백엔드 `/api/**`를 거친다.
- 화면 컴포넌트에서 `fetch`를 직접 쓰지 않는다. `src/api/`를 거친다.
  소셜 로그인 이동(`window.location.href`)만 예외다.
- `localStorage`의 토큰 접근은 `src/utils/auth.ts` 안에서만. 캐시용은 `src/utils/cache.ts`.
- 상승은 빨강(`--color-up`), 하락은 파랑(`--color-down`), 보합은 검정(`--color-text`).
- `.env`는 커밋하지 않는다. `.env.example`만 올린다.
