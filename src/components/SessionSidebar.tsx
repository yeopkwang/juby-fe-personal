import type { ChatSession } from '../types/ai'
import styles from './SessionSidebar.module.css'

interface Props {
  sessions: ChatSession[]
  /** 지금 보고 있는 세션. 새 대화 중이면 null */
  selectedId: number | null
  onSelect: (sessionId: number) => void
  onNewChat: () => void
  /** 비로그인이면 목록 대신 안내를 띄운다. 대화 이력은 계정에 귀속되기 때문 */
  isLoggedIn: boolean
}

export default function SessionSidebar({
  sessions,
  selectedId,
  onSelect,
  onNewChat,
  isLoggedIn,
}: Props) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.head}>
        <h2 className={styles.headTitle}>이전 대화내용</h2>
        {/*
          피그마에는 없지만 필요하다. 세션을 한 번 고르고 나면
          빈 화면으로 돌아갈 방법이 사라진다.
        */}
        <button type="button" className={styles.newChat} onClick={onNewChat}>
          + 새 대화
        </button>
      </div>

      {!isLoggedIn ? (
        <p className={styles.empty}>로그인하면 이전 대화를 저장할 수 있어요.</p>
      ) : sessions.length === 0 ? (
        <p className={styles.empty}>이전 대화가 없습니다</p>
      ) : (
        <ul className={styles.list}>
          {sessions.map((session) => {
            const isSelected = session.sessionId === selectedId

            return (
              <li key={session.sessionId}>
                <button
                  type="button"
                  className={
                    isSelected ? `${styles.item} ${styles.itemOn}` : styles.item
                  }
                  onClick={() => onSelect(session.sessionId)}
                  aria-current={isSelected}
                  /* 한 줄로 자르므로 전체 제목은 툴팁으로 남긴다 */
                  title={session.title}
                >
                  {session.title}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
