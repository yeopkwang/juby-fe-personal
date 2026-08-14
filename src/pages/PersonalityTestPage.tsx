import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getQuestions, submitTest } from '../api/personality'
import type { Question } from '../types/personality'
import styles from './PersonalityTestPage.module.css'

/** 화면 흐름상 전부 고른 뒤에만 부르므로 못 찾는 보기는 없다 */
function toScores(questions: Question[], answers: (number | null)[]): number[] {
  return questions.map((question, index) => {
    const chosen = question.choices.find(
      (choice) => choice.choiceId === answers[index],
    )
    return chosen === undefined ? 0 : chosen.score
  })
}

export default function PersonalityTestPage() {
  const navigate = useNavigate()
  /* 어디서 들어왔는지(?from=mypage)를 결과 화면까지 그대로 넘긴다 */
  const { search } = useLocation()

  const [questions, setQuestions] = useState<Question[] | null>(null)
  /** 문항을 못 받았다. 화면에 그릴 게 아무것도 없어 통째로 대체된다 */
  const [loadFailed, setLoadFailed] = useState(false)
  /**
   * 마지막에 결과를 못 받았다. **화면을 갈아치우지 않는다.**
   *
   * 예전에는 이것도 위의 loadFailed로 처리해서, 열 문항을 다 푼 사람이
   * '문항을 불러오지 못했습니다'라는 엉뚱한 말과 함께 답을 통째로 잃었다.
   * 고른 답은 그대로 두고 버튼 옆에만 알린다 — 한 번 더 누르면 다시 보낸다.
   */
  const [submitError, setSubmitError] = useState('')
  /** 문항마다 고른 보기의 choiceId. 아직 안 고른 문항은 null */
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    getQuestions()
      .then((loaded) => {
        setQuestions(loaded)
        setAnswers(Array(loaded.length).fill(null))
      })
      .catch((error: unknown) => {
        console.warn('성향 테스트 문항 조회 실패', error)
        setLoadFailed(true)
      })
  }, [])

  if (loadFailed) {
    return <p className={styles.message}>문항을 불러오지 못했습니다.</p>
  }
  if (questions === null) {
    return <p className={styles.message}>불러오는 중…</p>
  }

  const total = questions.length
  const question = questions[currentIndex]
  const selectedId = answers[currentIndex]
  const isLast = currentIndex === total - 1

  function handleSelect(choiceId: number) {
    // 배열을 직접 고치면 React가 같은 객체로 보고 다시 그리지 않는다. 새 배열을 만든다
    setAnswers((previous) =>
      previous.map((answer, index) =>
        index === currentIndex ? choiceId : answer,
      ),
    )
  }

  async function handleNext() {
    if (questions === null) return

    if (!isLast) {
      setCurrentIndex((index) => index + 1)
      return
    }

    setIsSubmitting(true)
    setSubmitError('')
    try {
      const result = await submitTest(toScores(questions, answers))
      navigate(
        { pathname: '/personality-test/result', search },
        { state: { result } },
      )
    } catch (error: unknown) {
      console.warn('성향 산출 실패', error)
      setSubmitError('결과를 내지 못했어요. 잠시 후 다시 눌러주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <h1 className={styles.title}>나의 투자성향 테스트</h1>

      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={currentIndex + 1}
      >
        <div
          className={styles.progressFill}
          style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
        />
      </div>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.questionNo}>Q{currentIndex + 1}.</span>
          <span className={styles.counter}>
            {currentIndex + 1} / {total}
          </span>
        </div>

        <p className={styles.question}>{question.content}</p>

        <div className={styles.choices}>
          {question.choices.map((choice) => {
            const isSelected = choice.choiceId === selectedId

            return (
              <button
                key={choice.choiceId}
                type="button"
                className={
                  isSelected
                    ? `${styles.choice} ${styles.choiceSelected}`
                    : styles.choice
                }
                onClick={() => handleSelect(choice.choiceId)}
                aria-pressed={isSelected}
              >
                {choice.content}
              </button>
            )
          })}
        </div>

        {submitError !== '' && (
          <p className={styles.submitError} role="alert">
            {submitError}
          </p>
        )}

        <div className={styles.buttons}>
          <button
            type="button"
            className={styles.prev}
            onClick={() => setCurrentIndex((index) => index - 1)}
            disabled={currentIndex === 0}
          >
            이전
          </button>
          <button
            type="button"
            className={styles.next}
            onClick={handleNext}
            disabled={selectedId === null || isSubmitting}
          >
            {isLast ? '결과 보기' : '다음'}
          </button>
        </div>
      </section>
    </>
  )
}
