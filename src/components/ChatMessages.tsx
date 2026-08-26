import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../types/ai'
import styles from './ChatMessages.module.css'

/** 답변을 기다리는 중인지. 끝났으면 null */
export type PendingState = 'loading' | null

interface Props {
  messages: ChatMessage[]
  pending: PendingState
  /** 못 받았을 때 적을 한 문장. 성공했으면 null. utils/error.ts의 toUserMessage가 만든다 */
  errorMessage: string | null
  /**
   * 다시 부를 방법. 없으면 버튼을 그리지 않는다.
   * 눌러도 결과가 같은 실패가 있어서다. utils/error.ts의 isRetryable이 판단한다.
   */
  onRetry?: () => void
}

export default function ChatMessages({
  messages,
  pending,
  errorMessage,
  onRetry,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  /*
   * 새 말풍선이 붙으면 맨 아래로 내린다.
   * pending도 의존성에 넣는 이유: 로딩 자리와 실제 답변은 높이가 달라서
   * 답변으로 바뀌는 순간에도 다시 내려줘야 끝이 가려지지 않는다.
   */
  useEffect(() => {
    const element = scrollRef.current
    if (element === null) return
    element.scrollTop = element.scrollHeight
  }, [messages, pending, errorMessage])

  return (
    <div className={styles.scroll} ref={scrollRef}>
      {messages.map((message) => (
        <div
          key={message.messageId}
          className={
            message.role === 'user'
              ? `${styles.row} ${styles.rowUser}`
              : styles.row
          }
        >
          {/*
            AI 응답은 일반 텍스트로만 그린다. dangerouslySetInnerHTML을 쓰면
            모델 출력이 HTML로 해석되어 보안 문제가 된다.
            줄바꿈(\n)은 CSS의 white-space: pre-wrap이 살려준다.
          */}
          <p
            className={
              message.role === 'user'
                ? `${styles.bubble} ${styles.bubbleUser}`
                : styles.bubble
            }
          >
            {message.content}
          </p>
        </div>
      ))}

      {pending === 'loading' && (
        <div className={styles.row}>
          <p className={`${styles.bubble} ${styles.loading}`} aria-live="polite">
            <span className={styles.srOnly}>답변을 생성하고 있어요</span>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.dot} aria-hidden="true" />
          </p>
        </div>
      )}

      {errorMessage !== null && (
        <div className={styles.row}>
          <p className={`${styles.bubble} ${styles.error}`}>
            {errorMessage}
            {onRetry !== undefined && (
              <button type="button" className={styles.retry} onClick={onRetry}>
                다시 시도
              </button>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
