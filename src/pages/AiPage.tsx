import { LogoWord } from '../components/Logo'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ask, getSessionDetail, getSessions } from '../api/ai'
import { getMyPersonality } from '../api/member'
import ChatMessages, { type PendingState } from '../components/ChatMessages'
import SessionSidebar from '../components/SessionSidebar'
import Skeleton from '../components/Skeleton'
import { useIsLoggedIn } from '../hooks/useIsLoggedIn'
import { findStockName } from '../utils/stockName'
import type { ChatMessage, ChatSession } from '../types/ai'
import type { PersonalityType } from '../types/personality'
import styles from './AiPage.module.css'

/** 검사를 마치면 from=ai를 보고 이 화면으로 돌려보낸다 */
const PERSONALITY_TEST_URL = '/personality-test?from=ai'

const STOCK_HINT = '종목명을 함께 입력하면 더 정확한 분석을 받을 수 있어요.'

type DetailState = 'idle' | 'loading' | 'error'

export default function AiPage() {
  const loggedIn = useIsLoggedIn()

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [detailState, setDetailState] = useState<DetailState>('idle')

  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState<PendingState>(null)
  const [notice, setNotice] = useState('')
  const [personality, setPersonality] = useState<PersonalityType | null>(null)

  /*
   * 화면에서 바로 만든 메시지에 붙일 번호. 서버가 주는 번호는 양수라서 음수로 내려가며 쓴다.
   * 겹치면 React가 두 말풍선을 같은 것으로 보고 하나를 지운다.
   */
  const localIdRef = useRef(-1)
  /** 실패한 질문. '다시 시도'가 이걸 그대로 다시 보낸다 */
  const lastAskRef = useRef<{ text: string; stockName: string } | null>(null)

  useEffect(() => {
    getSessions()
      .then(setSessions)
      .catch((error: unknown) => {
        // 목록을 못 받아도 질문은 할 수 있다. 사이드바만 비워둔다
        console.warn('AI 대화 목록 조회 실패', error)
      })

    // 토큰이 없으면 부를 이유가 없다. 성향 영역은 어차피 숨겨진다
    if (loggedIn) {
      getMyPersonality()
        // 이 화면은 실패 이유를 가리지 않는다. 못 받으면 성향 영역을 숨길 뿐이다
        .catch(() => null)
        .then((info) => setPersonality(info?.investPersonality ?? null))
    }
  }, [loggedIn])

  function nextLocalId(): number {
    const id = localIdRef.current
    localIdRef.current -= 1
    return id
  }

  function handleNewChat() {
    setSessionId(null)
    setMessages([])
    setDetailState('idle')
    setPending(null)
    setNotice('')
  }

  function handleSelect(selectedId: number) {
    // 보고 있는 세션을 또 누른 것뿐이다. 다시 받아올 이유가 없다
    if (selectedId === sessionId && detailState !== 'error') return

    setSessionId(selectedId)
    setPending(null)
    setNotice('')
    setDetailState('loading')

    getSessionDetail(selectedId)
      .then((detail) => {
        setMessages(detail.messages)
        setDetailState('idle')
      })
      .catch((error: unknown) => {
        console.warn('AI 대화 조회 실패', error)
        setDetailState('error')
      })
  }

  async function send(text: string, stockName: string) {
    lastAskRef.current = { text, stockName }
    setPending('loading')

    try {
      const result = await ask(text, stockName, sessionId ?? undefined)

      setMessages((previous) => [
        ...previous,
        {
          messageId: nextLocalId(),
          role: 'assistant',
          content: result.answer,
          createdAt: new Date().toISOString(),
        },
      ])
      setPending(null)

      // 새 대화였다면 방금 발급받은 세션으로 옮겨 앉고 목록 맨 위에 올린다
      if (sessionId === null) {
        setSessionId(result.sessionId)
        setSessions((previous) => [
          { sessionId: result.sessionId, title: result.title },
          ...previous,
        ])
      }
    } catch (error: unknown) {
      console.warn('AI 질문 전송 실패', error)
      setPending('error')
    }
  }

  function handleSubmit() {
    const text = question.trim()
    // 공백만 친 경우까지 걸러진다
    if (text === '' || pending === 'loading') return

    const stockName = findStockName(text)

    /* 내 질문을 먼저 띄운다. 서버를 기다렸다 그리면 반응이 느리게 느껴진다 */
    setMessages((previous) => [
      ...previous,
      {
        messageId: nextLocalId(),
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      },
    ])
    setQuestion('')
    setNotice(stockName === '' ? STOCK_HINT : '')

    void send(text, stockName)
  }

  function handleRetry() {
    const last = lastAskRef.current
    if (last === null) return
    void send(last.text, last.stockName)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Shift+Enter는 줄바꿈으로 둔다. 조합 중인 한글이 확정되는 엔터도 보내면 안 된다
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return
    }
    event.preventDefault()
    handleSubmit()
  }

  const isEmpty = messages.length === 0 && pending === null

  return (
    <>
      <h1 className={styles.title}>AI 주가분석 이용하기</h1>

      <div className={styles.layout}>
        <SessionSidebar
          sessions={sessions}
          selectedId={sessionId}
          onSelect={handleSelect}
          onNewChat={handleNewChat}
          isLoggedIn={loggedIn}
        />

        <section className={styles.chat}>
          {detailState === 'loading' ? (
            /* 낱장에 문구를 붙이지 않는다. "불러오는 중"을 네 번 읽어 봐야 소용없다 */
            <div className={styles.skeletonArea} aria-label="대화를 불러오는 중">
              <Skeleton className={`${styles.skeleton} ${styles.skeletonUser}`} />
              <Skeleton className={styles.skeleton} />
              <Skeleton className={`${styles.skeleton} ${styles.skeletonUser}`} />
              <Skeleton className={styles.skeleton} />
            </div>
          ) : detailState === 'error' ? (
            <div className={styles.centerArea}>
              <p className={styles.errorText}>대화를 불러오지 못했습니다.</p>
              <button
                type="button"
                className={styles.darkButton}
                onClick={() => {
                  if (sessionId !== null) handleSelect(sessionId)
                }}
              >
                다시 시도
              </button>
            </div>
          ) : isEmpty ? (
            <div className={styles.centerArea}>
              <LogoWord className={styles.watermark} />
              <p className={styles.watermarkSub}>AI 도우미</p>

              {/* 성향을 모르면 이 영역 자체를 숨긴다. 지어낸 값을 보여줄 수는 없다 */}
              {personality !== null && (
                <div className={styles.personality}>
                  <p className={styles.personalityText}>
                    현재 당신의 투자성향은 ‘{personality}’ 입니다.
                  </p>
                  <Link
                    className={styles.darkButton}
                    to={PERSONALITY_TEST_URL}
                  >
                    투자성향 변경하기
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <ChatMessages
              messages={messages}
              pending={pending}
              onRetry={handleRetry}
            />
          )}

          {notice !== '' && <p className={styles.notice}>{notice}</p>}

          <div className={styles.composer}>
            <div className={styles.composerBox}>
              <textarea
                className={styles.input}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="예시 : 삼성전자의 주가 현황을 알려줘."
                rows={1}
                disabled={pending === 'loading'}
                aria-label="질문 입력"
              />
              <button
                type="button"
                className={styles.send}
                onClick={handleSubmit}
                disabled={pending === 'loading' || question.trim() === ''}
              >
                보내기
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
