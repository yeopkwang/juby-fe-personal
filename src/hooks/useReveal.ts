import { useEffect, useState } from 'react'

/**
 * 결과가 나타날 때 쓰는 두 가지 도우미.
 *
 * 백테스트 결과는 API 여섯 건을 기다린 끝에 나오는데, 그동안 아무것도 없다가
 * **완성된 막대와 숫자가 툭 나타나서** 화면이 뚝딱거린다. 값이 0에서 자라 올라오면
 * 기다림의 끝이 결과로 이어져 보인다.
 *
 * 계산 시간을 가리는 장치는 아니다. 축 점수 되계산은 숫자 열두 개로 하는 산수라
 * 순식간에 끝난다. 실제로 기다리는 건 통신이고, 이건 그 뒤에 붙는 마무리다.
 */

/** 기본 자라는 시간. 막대 CSS의 transition과 같은 값이어야 함께 멎는다 */
const DURATION = 900

/**
 * 움직임을 줄여 달라고 설정한 사용자인가.
 *
 * 어지럼증이나 전정기관 장애가 있으면 움직이는 화면이 실제로 불편하다.
 * 그런 경우엔 애니메이션 없이 완성된 값을 바로 보여준다.
 */
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 처음 **그려진 뒤에** true가 된다.
 *
 * 막대 너비를 CSS transition으로 늘리려면 브라우저가 '0%인 상태'를 한 번 봐야 한다.
 * 0%와 최종값이 같은 프레임 안에서 정해지면 브라우저는 변화가 없었던 것으로 보고
 * 최종값만 그린다 — 전환이 통째로 건너뛰어진다.
 *
 * **프레임을 두 번 건너뛰는 이유가 여기 있다.** `requestAnimationFrame` 콜백은
 * 이름과 달리 '그린 뒤'가 아니라 **그리기 직전**에 실행된다. 한 번만 쓰면 아직
 * 0%가 화면에 나가기 전에 값을 바꿔 버려서 아무 일도 일어나지 않는다.
 * 실제로 그렇게 만들었다가 막대가 처음부터 완성된 채로 나타나는 걸 확인했다.
 * 두 번째 콜백은 0%가 한 번 그려진 다음 프레임에 온다.
 */
export function useGrown(): boolean {
  const [grown, setGrown] = useState(false)

  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setGrown(true))
    })

    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [])

  return grown
}

/**
 * 0에서 목표값까지 올라가는 숫자.
 *
 * 막대와 같은 시간, 같은 감속 곡선을 쓴다. 따로 놀면 숫자가 먼저 멎고 막대만
 * 늦게 도착해서 둘이 다른 값을 말하는 것처럼 보인다.
 *
 * 쓰는 쪽은 `tabular-nums`를 함께 걸어야 한다. 안 그러면 자릿수가 바뀔 때마다
 * 글자 폭이 달라져 숫자가 덜덜 떨린다.
 */
export function useCountUp(target: number, duration = DURATION): number {
  const [value, setValue] = useState(() =>
    prefersReducedMotion() ? target : 0,
  )

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target)
      return
    }

    let raf = 0
    const started = performance.now()

    function tick(now: number) {
      const progress = Math.min(1, (now - started) / duration)
      /* 끝에서 부드럽게 멎는다(ease-out). 막대 CSS의 곡선과 결을 맞춘 것 */
      setValue(target * (1 - Math.pow(1 - progress, 3)))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}
