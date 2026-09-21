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

시작 파일은 `index.html` 하나다. 주소는 전부 그 안의 라우터가 가른다.

| 주소 | 내용 |
| --- | --- |
| `/` | 홈 |
| `/stocks/:stockCode` | 종목 상세 |
| `/backtest` | 주식 백테스트 |
| `/ai` | AI 주가분석 |
| `/personality-test` | 투자성향 테스트 |
| `/mypage/personality`·`/likes`·`/profile` | 마이페이지 |
| `/guide` | 사용설명서 |
| `/login`·`/oauth/callback` | 로그인 |

투자성향 테스트에 `?from=mypage`(또는 `ai`)를 붙이면 검사를 마친 뒤 그 화면으로 돌아간다.

주소가 전부 한 파일에서 갈리므로, **배포할 때 없는 경로는 `index.html`을 돌려주도록**
정적 호스팅을 설정해야 새로고침에서 404가 나지 않는다.

## 명령어

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 후 빌드 |
| `npm run lint` | oxlint |
| `npm run preview` | 빌드 결과 확인 |

## 백엔드 연결

`.env`의 `VITE_API_BASE_URL`을 비워두면 `vite.config.ts`의 프록시를 타서
`/api` 요청이 백엔드로 넘어간다. 개발 중에는 비워두는 편이 CORS를 안 겪는다.

`VITE_API_ORIGIN`은 소셜 로그인 이동에만 쓴다.
브라우저 주소창이 직접 찾아가는 곳이라 프록시를 탈 수 없어 절대주소가 필요하다.

## 규칙

- 증권사(KIS) API를 프론트에서 직접 부르지 않는다. 반드시 백엔드 `/api/**`를 거친다.
- 화면 컴포넌트에서 `fetch`를 직접 쓰지 않는다. `src/api/`를 거친다.
  소셜 로그인 이동(`window.location.href`)만 예외다.
- `localStorage`의 토큰 접근은 `src/utils/auth.ts` 안에서만. 캐시용은 `src/utils/cache.ts`.
- 화면에서 로그인 여부는 `useIsLoggedIn()`으로 읽는다. 토큰이 생기거나 사라지면 따라 바뀐다.
  `isLoggedIn()`을 직접 부르는 건 화면 밖(`src/api/*`)이나 한 번만 읽으면 되는 자리다.
- 상승은 빨강(`--color-up`), 하락은 파랑(`--color-down`), 보합은 검정(`--color-text`).
- `.env`는 커밋하지 않는다. `.env.example`만 올린다.
