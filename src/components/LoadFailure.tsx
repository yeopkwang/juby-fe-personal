import styles from './LoadFailure.module.css'

interface Props {
  /** 무엇이 잘못됐는지 한 문장. utils/error.ts의 toUserMessage가 만든다 */
  message: string
  /**
   * 다시 부를 방법. 없으면 버튼을 그리지 않는다.
   * 눌러도 결과가 같은 실패가 있어서다(막힌 경로, 404). utils/error.ts의
   * isRetryable이 판단한다.
   */
  onRetry?: () => void
  /** 다시 부르는 중. 버튼을 잠가 같은 요청이 겹치지 않게 한다 */
  isRetrying?: boolean
}

/**
 * 못 불러왔을 때 자리를 대신 채우는 안내.
 *
 * 예전에는 화면마다 `<p>차트를 불러오지 못했습니다.</p>` 한 줄이 전부라 나갈 길이
 * 새로고침(F5)뿐이었고, 그러면 받아 둔 다른 것까지 전부 다시 받는다.
 * 세 화면(홈 카드·상세 차트·뉴스)이 같은 모양이어야 해서 컴포넌트로 묶었다.
 */
export default function LoadFailure({ message, onRetry, isRetrying }: Props) {
  return (
    <div className={styles.wrap} role="status">
      <p className={styles.message}>{message}</p>

      {onRetry !== undefined && (
        <button
          type="button"
          className={styles.retry}
          onClick={onRetry}
          disabled={isRetrying === true}
        >
          {isRetrying === true ? '불러오는 중…' : '다시 시도'}
        </button>
      )}
    </div>
  )
}
