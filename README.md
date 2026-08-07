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

시작 파일이 두 벌이라 주소도 두 개다.

| 주소 | 내용 |
| --- | --- |
| `/` | 홈, 종목 상세, 로그인 |
| `/personality.html` | 투자성향 테스트 |

투자성향 테스트는 `personality.html`로 따로 떨어져 있다.
가입 흐름과 마이페이지가 생기면 본 앱 안으로 들인다.
`?from=mypage`를 붙이면 검사를 마친 뒤 마이페이지로 돌아간다.

## 명령어

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 후 빌드 (두 페이지 모두) |
| `npm run lint` | oxlint |
| `npm run preview` | 빌드 결과 확인 |

## 백엔드 연결

`.env`의 `VITE_API_BASE_URL`을 비워두면 `vite.config.ts`의 프록시를 타서
`/api`와 `/v1` 요청이 백엔드로 넘어간다. 개발 중에는 비워두는 편이 CORS를 안 겪는다.

`VITE_API_ORIGIN`은 소셜 로그인 이동에만 쓴다.
브라우저 주소창이 직접 찾아가는 곳이라 프록시를 탈 수 없어 절대주소가 필요하다.

## 규칙

- 증권사(KIS) API를 프론트에서 직접 부르지 않는다. 반드시 백엔드 `/api/**`를 거친다.
- 화면 컴포넌트에서 `fetch`를 직접 쓰지 않는다. `src/api/`를 거친다.
  소셜 로그인 이동(`window.location.href`)만 예외다.
- `localStorage`의 토큰 접근은 `src/utils/auth.ts` 안에서만. 캐시용은 `src/utils/cache.ts`.
- 상승은 빨강(`--color-up`), 하락은 파랑(`--color-down`), 보합은 검정(`--color-text`).
- `.env`는 커밋하지 않는다. `.env.example`만 올린다.
