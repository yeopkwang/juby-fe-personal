import styles from './LoadFailure.module.css'

interface Props {
  /** 무엇이 잘못됐는지 한 문장. utils/error.ts의 toUserMessage가 만든다 */
  message: string
  /**
   * 다시 부를 방법. **없으면 버튼을 그리지 않는다.**
   *
   * 다시 눌러도 결과가 같은 실패가 있다 — 허용 목록에 없는 경로, 없는 종목(404).
   * 그런 자리에 버튼을 두면 눌러도 아무 일이 안 생겨서, 사용자는 자기 인터넷을
   * 의심하며 계속 누른다. 눌러 볼 만한지는 utils/error.ts의 isRetryable이 판단한다.
   */
  onRetry?: () => void
  /** 다시 부르는 중. 버튼을 잠가 같은 요청이 겹치지 않게 한다 */
  isRetrying?: boolean
}

/**
 * 못 불러왔을 때 자리를 대신 채우는 안내.
 *
 * 예전에는 화면마다 `<p>차트를 불러오지 못했습니다.</p>` 한 줄이 전부였다.
 * 그 한 줄에는 **나갈 길이 없다.** 서버가 잠깐 흔들린 것이어도 사용자가 할 수 있는 건
 * 새로고침(F5)뿐인데, 그러면 이미 받아 둔 다른 것들까지 전부 다시 받는다.
 *
 * 세 화면(홈 카드·상세 차트·뉴스)이 같은 모양이어야 해서 컴포넌트로 묶었다.
 * CSS Modules는 클래스 이름을 파일마다 따로 만들기 때문에 스타일시트만 공유해서는
 * 합쳐지지 않는다(Skeleton을 컴포넌트로 묶은 것과 같은 이유다).
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
