import { Link } from 'react-router-dom'
import type { MyPersonality } from '../../hooks/useMyPersonality'
import styles from '../../pages/AiPage.module.css'

/** 검사를 마치면 doneRoute가 from=ai를 보고 AI 화면으로 돌려보낸다 */
export const PERSONALITY_TEST_URL = '/personality-test?from=ai'

/** 비로그인 첫 화면의 예시 질문. 누르면 입력칸에 채우기만 한다(보내지 않는다 — 보내려면 로그인해야 한다) */
const EXAMPLE_QUESTIONS = [
  '삼성전자 요즘 왜 올랐어?',
  '나한테 맞는 전략은 뭐야?',
  'SK하이닉스랑 삼성전자 중에 뭐가 나아?',
]

interface Props {
  loggedIn: boolean
  personality: MyPersonality
  onRetryPersonality: () => void
  /** 예시 질문을 눌렀다. 화면이 입력칸에 채우고 포커스를 준다 */
  onPickExample: (text: string) => void
}

/**
 * 말풍선이 하나도 없을 때의 대화창(2026-10-31 pages/AiPage.tsx에서 나눔).
 * 성향이 있으면 보여주고, 로그인했는데 없으면 검사를 권한다 — 성향 없는 회원의 질문은 서버가 거절하므로 미리 알려야 한다.
 * 못 불러왔으면 검사를 권하지 않는다(다시 검사하면 멀쩡한 성향을 덮어쓴다). 비로그인은 예시 질문, 불러오는 중은 성향 영역을
 * 숨긴다. 지어낸 값을 보여줄 수는 없다.
 */
export default function ChatEmptyState({ loggedIn, personality, onRetryPersonality, onPickExample }: Props) {
  return (
    <div className={styles.centerArea}>
      <p className={styles.watermark}>JUBY</p>
      <p className={styles.watermarkSub}>AI 도우미</p>

      {personality.kind === 'found' ? (
        <div className={styles.personality}>
          <p className={styles.personalityText}>현재 당신의 투자성향은 ‘{personality.name}’입니다.</p>
          <Link className={styles.darkButton} to={PERSONALITY_TEST_URL}>
            투자성향 변경하기
          </Link>
        </div>
      ) : personality.kind === 'error' ? (
        <div className={styles.personality}>
          <p className={styles.personalityText}>성향을 불러오지 못했어요.</p>
          <button type="button" className={styles.darkButton} onClick={onRetryPersonality}>
            다시 시도
          </button>
        </div>
      ) : !loggedIn ? (
        <div className={styles.examples}>
          <p className={styles.examplesTitle}>이렇게 물어볼 수 있어요</p>
          <div className={styles.exampleList}>
            {EXAMPLE_QUESTIONS.map((example) => (
              <button
                key={example}
                type="button"
                className={styles.exampleChip}
                onClick={() => onPickExample(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      ) : personality.kind === 'none' ? (
        <div className={styles.personality}>
          <p className={styles.personalityText}>투자성향을 정하면 나에게 맞춘 답을 받을 수 있어요.</p>
          <Link className={styles.darkButton} to={PERSONALITY_TEST_URL}>
            투자성향 검사하기
          </Link>
        </div>
      ) : null}
    </div>
  )
}
