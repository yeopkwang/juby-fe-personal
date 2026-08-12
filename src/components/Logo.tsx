import { useId } from 'react'

/*
 * JUBY 로고. 심볼과 글자를 따로 내보낸다.
 *
 * **글자가 폰트가 아니라 도형이다.** 예전에는 구글 폰트(Michroma)를 받아 'JUBY'
 * 네 글자를 그렸는데, 그 네 글자 때문에 외부 서버에 세 번 다녀왔고 폰트가 늦게 오면
 * 로고가 잠깐 다른 글씨로 보였다가 바뀌었다. 도형으로 그리면 그 왕복이 없고
 * 어느 기기에서나 같은 모양이 나온다.
 *
 * 파비콘(public/favicon.svg)은 문서 밖이라 이 파일을 못 쓴다. 같은 도형을 복사해
 * 두었으니 **심볼을 고치면 그쪽도 함께 고친다.**
 */

interface Props {
  className?: string
}

/**
 * 심볼 — 싹 튼 캔들.
 *
 * 상승 캔들 위쪽 심지가 올라가면서 색이 빨강에서 초록으로 넘어가 그대로 줄기가 된다.
 * 캔들과 새싹 사이에 이음매가 없는 것이 이 도형의 요점이다.
 *
 * 색을 CSS 변수로 빼지 않았다. 로고는 화면 테마를 따라 바뀌면 안 되고
 * (짙은 초록 타일이 로고의 일부다), 파비콘과 값이 어긋나서도 안 된다.
 */
export function LogoMark({ className }: Props) {
  /*
   * 한 화면에 로고가 둘 이상 있어도(헤더 + AI 배경) 그라디언트 id가 겹치지 않게 한다.
   * 겹치면 나중에 그려진 쪽이 앞의 것을 덮어써서 색이 뒤바뀐다.
   */
  const uid = useId()
  const leafYoung = `${uid}-leaf-young`
  const leafGrown = `${uid}-leaf-grown`
  const wick = `${uid}-wick`

  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={leafYoung} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#63c88e" />
          <stop offset="1" stopColor="#c6f0d3" />
        </linearGradient>
        <linearGradient id={leafGrown} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#2f9c6a" />
          <stop offset="1" stopColor="#8adfae" />
        </linearGradient>
        {/* 여기서 캔들이 새싹이 된다 */}
        <linearGradient id={wick} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#f04452" />
          <stop offset="1" stopColor="#8adfae" />
        </linearGradient>
      </defs>

      <rect width="48" height="48" rx="13" fill="#0d5c3d" />

      {/* 아래 심지. 몸통보다 훨씬 가늘어야 한다 — 굵으면 막대사탕이 된다 */}
      <path
        d="M24 42 L24 44.5"
        stroke="#f04452"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <rect x="18" y="26" width="12" height="16" rx="2.5" fill="#f04452" />
      <path
        d="M24 27 L24 20"
        stroke={`url(#${wick})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* 작고 낮은 잎이 갓 난 잎, 크고 높은 잎이 자란 잎. 자라는 방향이 생긴다 */}
      <path
        d="M24 23 A9.5 9.5 0 0 1 14 11 A9.5 9.5 0 0 1 24 23 Z"
        fill={`url(#${leafYoung})`}
      />
      <path
        d="M24 20 A10.5 10.5 0 0 1 35 8.5 A10.5 10.5 0 0 1 24 20 Z"
        fill={`url(#${leafGrown})`}
      />
    </svg>
  )
}

/**
 * 글자 — JUBY.
 *
 * 선을 그은 것이 아니라 면으로 그렸다. 그래서 획 안에서 굵기가 변한다 —
 * U와 J의 바닥 곡선이 세로획보다 가늘다(곡선은 눈에 더 두꺼워 보인다).
 * 그리고 둥근 글자는 기준선(y=100)을 103까지 넘어간다. 딱 맞추면 오히려 짧아 보인다.
 *
 * Y만 왼쪽으로 12 당겨 놓았다. 팔이 위에서 벌어져 있어 다른 글자와 같은 간격을 주면
 * 아래에 빈 쐐기가 생겨 혼자 떨어져 보인다.
 *
 * 색은 currentColor라 부르는 쪽 글자색을 그대로 따른다.
 */
export function LogoWord({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 14 275 95"
      role="img"
      aria-label="JUBY"
    >
      <g fill="currentColor" fillRule="evenodd">
        <path d="M35 20 L52 20 L52 70 C52 90 39 103 21 103 C11 103 3 98 0 90 L14 82 C16 86 18 89 22 89 C30 89 35 83 35 70 Z" />
        <path d="M68 20 L85 20 L85 72 C85 82 92 90 102 90 C112 90 119 82 119 72 L119 20 L136 20 L136 72 C136 90 121 103 102 103 C83 103 68 90 68 72 Z" />
        <path d="M152 20 L186 20 C196 20 203 27 203 37 C203 44 199 50 193 53 C202 55 209 63 209 75 C209 89 199 100 185 100 L152 100 Z M167 32 L167 51 L183 51 C189 51 192 46 192 41 C192 35 189 32 183 32 Z M167 62 L167 87 L184 87 C191 87 196 82 196 75 C196 67 191 62 184 62 Z" />
        <path d="M213 20 L229 20 L244 47 L259 20 L275 20 L252 62 L252 100 L236 100 L236 62 Z" />
      </g>
    </svg>
  )
}
