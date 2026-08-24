import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import styles from './ErrorBoundary.module.css'

/**
 * 화면 하나가 터졌을 때 앱 전체가 흰 화면이 되는 것을 막는다.
 *
 * 리액트는 그리는 도중 예외가 나면 화면 전체를 지운다. 헤더도 주소도 남지 않아
 * 사용자는 새로고침 말고 할 수 있는 게 없다.
 *
 * 클래스로 쓴 건 리액트가 이 기능을 훅으로 열어 주지 않아서다
 * (getDerivedStateFromError를 가진 클래스만 자식의 예외를 받는다).
 * 이 코드베이스에서 클래스 컴포넌트가 있는 유일한 자리다.
 *
 * 그리는 도중에 난 예외만 잡는다. 이벤트 핸들러나 .catch()가 붙은 요청 실패는
 * 여기 오지 않는다 — 그건 각 화면이 자기 상태로 다루는 게 맞다.
 */

interface Props {
  children: ReactNode
  /**
   * 이 값이 바뀌면 접어 둔 화면을 다시 펴 본다. 주소(pathname)를 넣어 두면 다른
   * 화면으로 옮기는 것만으로 풀린다. 없으면 헤더 메뉴를 눌러도 오류 화면이 남는다.
   *
   * 자식을 key로 갈아끼우지 않는 건, key를 주소로 걸면 종목을 갈아탈 때마다
   * 차트가 통째로 새로 만들어져 깜빡이기 때문이다.
   */
  resetKey?: string
}

interface State {
  /** 접힌 이유. 안 접혔으면 null */
  error: Error | null
  /**
   * 마지막으로 본 resetKey. componentDidUpdate에서 setState를 부르면 화면을 한 번
   * 더 그리게 되므로(오류 화면을 그렸다 곧바로 지우는 셈) 그리기 전에 갈아치운다.
   */
  resetKey: string | undefined
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null, resetKey: props.resetKey }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  /** 주소가 바뀌었으면 접힌 것을 편다. 오류가 난 순간에는 resetKey가 그대로라 안 걸린다 */
  static getDerivedStateFromProps(
    props: Props,
    state: State,
  ): Partial<State> | null {
    if (props.resetKey === state.resetKey) return null
    return { error: null, resetKey: props.resetKey }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 화면에는 뭉뚱그려 보여주므로 원인은 여기 남긴다. componentStack이 위치를 알려준다
    console.error('화면을 그리다 멈췄습니다', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error === null) return this.props.children

    return (
      <div className={styles.wrap} role="alert">
        <p className={styles.title}>화면을 여는 중 문제가 생겼습니다</p>
        <p className={styles.description}>
          잠깐의 문제일 수 있습니다. 다시 시도해 보고, 그래도 같으면 홈으로
          돌아가 주세요.
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.retry}
            onClick={this.handleRetry}
          >
            다시 시도
          </button>
          <Link to="/" className={styles.home}>
            홈으로 가기
          </Link>
        </div>
      </div>
    )
  }
}
