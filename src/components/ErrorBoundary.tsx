import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import styles from './ErrorBoundary.module.css'

interface Props {
  children: ReactNode
  /**
   * 이 값이 바뀌면 오류 상태를 푼다. App이 현재 경로를 넘긴다 —
   * 안 그러면 메뉴를 눌러 다른 화면으로 가도 오류 화면에 갇힌다.
   * key로 갈아끼우지 않는 이유는 그러면 평소 이동에도 화면이 통째로 다시 그려지기 때문이다.
   */
  resetKey: string
}

interface State {
  hasError: boolean
  /** 오류를 받아낼 당시의 resetKey. 이게 달라지면 다른 화면으로 옮겼다는 뜻이다 */
  resetKey: string
}

/**
 * 화면 하나가 예외로 멈춰도 앱 전체가 흰 화면이 되지 않게 받아낸다.
 *
 * 경계가 없으면 React가 트리를 통째로 지워서 `<div id="root">`가 비고, 사용자는
 * 아무 설명도 버튼도 없는 흰 화면을 본다. 이 경계는 머리글 아래만 갈아끼우므로
 * 메뉴로 다른 화면에 갈 수 있다.
 *
 * 클래스인 이유: 오류를 받아내는 수단이 React 19에도 클래스 쪽에만 있다.
 *
 * 받아내지 못하는 것도 있다 — 이벤트 처리 중에 난 오류, 비동기 콜백, 서버 통신 실패는
 * 각 화면이 알아서 처리한다. 여기는 '그리다가' 난 오류만 온다.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true }
  }

  /** 경로가 바뀌면 오류를 푼다. 그리기 직전에 판단하므로 덧그리는 일이 없다 */
  static getDerivedStateFromProps(props: Props, state: State): State | null {
    if (props.resetKey === state.resetKey) return null
    return { hasError: false, resetKey: props.resetKey }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 화면에는 자세한 내용을 안 띄운다. 개발자 도구에는 남겨야 원인을 찾는다
    console.error('화면을 그리다 멈췄습니다', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>화면을 표시하지 못했어요</h1>
        <p className={styles.description}>
          예상하지 못한 문제가 생겼습니다.
          <br />
          다시 시도해도 같으면 잠시 후에 열어 주세요.
        </p>

        <div className={styles.actions}>
          {/*
            상태만 되돌리지 않고 페이지를 새로 받는다. 화면 묶음을 받다가 실패한 경우
            (배포로 파일 이름이 바뀐 뒤 옛 주소를 물었을 때)가 흔한데,
            그건 다시 그리는 것으로는 안 풀리고 새로 받아야 풀린다.
          */}
          <button
            type="button"
            className={styles.retry}
            onClick={() => window.location.reload()}
          >
            다시 시도
          </button>

          <Link to="/" className={styles.home}>
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }
}
