import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import styles from './ErrorBoundary.module.css'

/**
 * 화면 하나가 터졌을 때 앱 전체가 흰 화면이 되는 것을 막는다.
 *
 * 리액트는 그리는 도중 예외가 나면 **화면 전체를 지운다.** 헤더도 주소도 남지 않아
 * 사용자는 새로고침 말고 할 수 있는 게 없고, 무엇이 잘못됐는지도 알 수 없다.
 * 실제로 이 앱은 그 위험을 알면서 우회해 왔다 — 성향 문항이 빈 배열로 오면 화면이
 * 터지니까 `getQuestions()`가 빈 목록을 일부러 '실패'로 던지는 식이었다
 * (src/api/personality.ts). 그건 그 한 자리만 막은 것이고, 이건 바닥을 까는 것이다.
 *
 * **클래스로 쓴 이유**는 리액트가 이 기능을 훅으로 열어 주지 않아서다.
 * `getDerivedStateFromError`를 가진 클래스만 자식의 예외를 받을 수 있다.
 * 이 파일이 이 코드베이스에서 클래스 컴포넌트가 있는 유일한 자리다.
 *
 * ## 무엇을 못 잡는가
 *
 * **그리는 도중에 난 예외만** 잡는다. 이벤트 핸들러 안(하트 클릭)이나
 * `.catch()`가 붙은 요청 실패는 여기 오지 않는다. 그런 것들은 각 화면이 이미
 * 자기 상태로 다루고 있고, 그게 맞다 — 화면 전체를 접을 일이 아니기 때문이다.
 * 여기 오는 것은 **아무도 예상 못 한 것**뿐이다.
 */

interface Props {
  children: ReactNode
  /**
   * 이 값이 바뀌면 접어 둔 화면을 다시 펴 본다.
   *
   * 주소(pathname)를 넣어 두면 사용자가 다른 화면으로 옮기는 것만으로 저절로 풀린다.
   * 이게 없으면 한 번 터진 뒤 헤더의 메뉴를 눌러도 오류 화면이 그대로 남는다 —
   * 주소만 바뀌고 그리는 쪽은 계속 접혀 있기 때문이다.
   *
   * **자식을 `key`로 갈아끼우지 않고 이 방식을 쓴다.** key를 주소로 걸면 종목을
   * 갈아탈 때마다(`/stocks/005930` → `/stocks/000660`) 차트가 통째로 새로 만들어져
   * 눈에 띄게 깜빡인다. 여기서 되돌리는 건 '접힘' 하나뿐이라 그 일이 없다.
   */
  resetKey?: string
}

interface State {
  /** 접힌 이유. 안 접혔으면 null */
  error: Error | null
  /**
   * 마지막으로 본 resetKey.
   *
   * 바뀌었는지 알려면 지난 값을 들고 있어야 한다. componentDidUpdate에서 setState를
   * 부르는 방법도 되지만 그건 화면을 한 번 더 그리게 만든다(오류 화면을 그렸다가
   * 곧바로 지우는 셈이다). 그릴 내용을 정하기 전에 갈아치우는 편이 낫다.
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
    /*
     * 사용자에게는 뭉뚱그려 보여주지만 원인은 남겨야 고칠 수 있다.
     * componentStack이 있어야 어느 화면의 어느 부분인지 알 수 있다.
     */
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
