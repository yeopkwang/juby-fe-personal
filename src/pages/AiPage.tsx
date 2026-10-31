import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DEFAULT_TITLE,
  ask,
  createSession,
  deleteSession,
  getSessionDetail,
  getSessions,
  renameSession,
} from '../api/ai'
import { ApiError } from '../api/client'
import ChatMessages, { type PendingState } from '../components/ChatMessages'
import { loadMarkdownAnswer } from '../components/loadMarkdownAnswer'
import SessionSidebar, { type SessionListState } from '../components/SessionSidebar'
import { useIsLoggedIn } from '../hooks/useIsLoggedIn'
import { useMyPersonality } from '../hooks/useMyPersonality'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAiHandoff } from '../hooks/useStockHandoff'
import type { ChatMessage, ChatSession } from '../types/ai'
import styles from './AiPage.module.css'

/** 검사를 마치면 doneRoute가 from=ai를 보고 이 화면으로 돌려보낸다 */
const PERSONALITY_TEST_URL = '/personality-test?from=ai'

const LOGIN_HINT = '로그인하면 질문할 수 있어요.'
const NO_PERSONALITY_HINT = '투자성향을 먼저 정해야 답할 수 있어요.'
/** 같은 대화방에서 앞 질문의 답을 서버가 아직 만드는 중(409 CHAT409_1). 질문은 저장되지 않았다 */
const BUSY_HINT = '앞 질문의 답을 아직 만들고 있어요. 조금 뒤에 다시 시도해 주세요.'
/** 다른 탭에서 지웠거나 내 것이 아닌 대화방(404 CHAT404_1·403 CHAT403_1) */
const ROOM_GONE_HINT = '이 대화방을 찾을 수 없어요. 새 대화에서 다시 물어봐 주세요.'
/** 서버 AskRequest의 question 최대 길이 */
const QUESTION_MAX_LENGTH = 1000

/** 비로그인 첫 화면의 예시 질문. 누르면 입력칸에 채우기만 한다(보내지 않는다 — 보내려면 로그인해야 한다) */
const EXAMPLE_QUESTIONS = [
  '삼성전자 요즘 왜 올랐어?',
  '나한테 맞는 전략은 뭐야?',
  'SK하이닉스랑 삼성전자 중에 뭐가 나아?',
]

/** 종목 상세의 'AI에게 물어보기'로 왔을 때 새 대화에 바로 보내는 질문 */
function briefingQuestion(stockName: string): string {
  return `${stockName}의 주가에 대해서 간단하게 브리핑을 해줘`
}

/** 보낼 질문과, 함께 실을 종목명(종목 상세에서 온 첫 질문만 — api/ai.ts ask) */
interface Question {
  text: string
  stockName: string | null
}

type DetailState = 'idle' | 'loading' | 'error'

/** 대화방이 없어진 경우의 오류인가(다시 받아도 같다) */
function isRoomGone(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'CHAT404_1' || error.code === 'CHAT403_1')
}

export default function AiPage() {
  useDocumentTitle('AI 주가분석')
  const loggedIn = useIsLoggedIn()

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [sessionsState, setSessionsState] = useState<SessionListState>('loading')
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [detailState, setDetailState] = useState<DetailState>('idle')

  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState<PendingState>(null)
  const [notice, setNotice] = useState('')

  /*
   * 화면에서 바로 만든 메시지에 붙일 번호. 서버가 주는 번호는 양수라서 음수로 내려가며 쓴다.
   * 겹치면 React가 두 말풍선을 같은 것으로 보고 하나를 지운다.
   */
  const localIdRef = useRef(-1)
  /** 예시 질문을 누르면 입력칸으로 옮겨 간다 */
  const inputRef = useRef<HTMLTextAreaElement>(null)
  /** 실패한 질문. '다시 시도'가 이걸 그대로 다시 보낸다(실었던 종목명도 그대로) */
  const lastAskRef = useRef<Question | null>(null)
  /*
   * 질문을 보낼 때마다 하나씩 올라가는 번호.
   * 답을 기다리는 동안 다른 대화방을 누르거나 새 대화를 열면 이 번호도 올라간다.
   * 답이 도착했을 때 번호가 달라져 있으면 보던 화면이 바뀐 것이므로 그 답은 버린다.
   * 안 그러면 A방에 물은 답이 B방 말풍선 뒤에 가서 붙는다.
   * 대화방 내용도 같은 번호로 거른다 — 방을 누르고 곧바로 새 대화를 열면 늦게 온
   * 그 방 말풍선이 새 대화 화면을 채운다.
   */
  const askSeqRef = useRef(0)
  /**
   * 대화방 목록 요청 번호. 답마다·이름을 바꾸거나 지울 때마다 목록을 다시 받으므로 늦게 온 옛 목록이 새 목록을 덮지 않게 한다
   * (답 뒤에 받기 시작한 목록이 방금 바꾼 제목이나 지운 방을 되살리지 않게)
   */
  const sessionsSeqRef = useRef(0)
  /*
   * 지금 보는 방. 이름 바꾸기·지우기는 서버를 기다린 뒤에 "보던 방이었나"를 가르는데, 그 함수가 만들어질 때의 sessionId는
   * 기다리는 사이 낡을 수 있다
   */
  const sessionIdRef = useRef(sessionId)
  useEffect(() => {
    sessionIdRef.current = sessionId
  })
  /**
   * 보던 자리(방·새 대화)가 바뀔 때마다 올라가는 번호. askSeq는 "그만 기다리기"에도 올라가지만 자리는 그대로다 —
   * 방을 만드는 사이 그만 기다렸어도 자리가 그대로면 만든 방을 쓴다(안 그러면 다시 시도가 방을 또 만들어 빈 방이 남았다)
   */
  const roomSeqRef = useRef(0)
  /** 지금 기다리는 질문 요청. "그만 기다리기"가 끊는다(연결을 닫을 뿐 서버는 답을 계속 만든다) */
  const abortRef = useRef<AbortController | null>(null)

  /**
   * 대화방 목록을 (다시) 받는다. 제목(첫 질문 앞 30자)과 순서(최근 대화 순)는 서버가 정하므로 답을 받을 때마다 조용히
   * 다시 받는다(quiet — 받는 동안 목록을 비우지 않는다). 비로그인이면 부르지 않는다 — 서버가 401로 막는다.
   */
  function loadSessions(quiet = false) {
    sessionsSeqRef.current += 1
    const seq = sessionsSeqRef.current
    if (!loggedIn) {
      setSessions([])
      setSessionsState('ready')
      return
    }
    if (!quiet) setSessionsState('loading')
    getSessions()
      .then((list) => {
        if (seq !== sessionsSeqRef.current) return
        setSessions(list)
        setSessionsState('ready')
      })
      .catch((error: unknown) => {
        if (seq !== sessionsSeqRef.current) return
        // 목록을 못 받아도 질문은 할 수 있다. 조용히 다시 받던 중이면 보던 목록을 둔다
        console.warn('AI 대화 목록 조회 실패', error)
        /*
         * 단, 아직 목록을 못 보여 준 채였으면(첫 목록을 받는 사이 답이 와서 이 요청이 그 요청을 밀어냈다) 실패로 보인다 —
         * 안 그러면 밀려난 첫 요청의 응답은 버려지고 이 요청은 조용히 끝나 "불러오는 중"에서 멈춘다
         */
        setSessionsState((state) => (quiet && state === 'ready' ? state : 'error'))
      })
  }

  /*
   * 답변 렌더러(마크다운·수식)를 화면이 뜨자마자 받기 시작한다. 말풍선 목록이 생길 때 받기 시작하면 저장된 방을 열거나
   * 첫 답이 올 때 서식 없는 글자가 한순간 보였다
   */
  useEffect(() => {
    void loadMarkdownAnswer()
  }, [])

  /*
   * 대화 목록은 회원마다 다르다. 로그인·로그아웃(다른 탭 포함)하면 다시 받고, 로그아웃하면 보던 대화도 거둔다 —
   * 계정의 대화라 로그아웃한 화면에 남으면 안 된다.
   */
  useEffect(() => {
    if (!loggedIn) startNewChat()
    loadSessions()
    // 로그인 여부가 바뀔 때만 돈다. 두 함수는 그 순간의 값을 쓰면 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn])

  /*
   * 종목 상세의 'AI에게 물어보기'로 왔으면 새 대화에 그 종목의 브리핑 질문을 한 번 보낸다(입력칸으로 보내는 것과 같은 길 — submit).
   * 보내면 비운다. ref라서 개발 서버(StrictMode)가 effect를 두 번 돌려도 한 번만 보낸다.
   * sendable은 비로그인으로 들어와 입력칸에 채우기만 했다는 표시다 — 나중에 다른 탭에서 로그인해도 저절로 보내지 않는다.
   */
  const { stock: handoff, session: sessionHandoff } = useAiHandoff()
  const handoffAskRef = useRef<(Question & { sendable: boolean }) | null>(
    handoff === null
      ? null
      : { text: briefingQuestion(handoff.stockName), stockName: handoff.stockName, sendable: true },
  )

  /*
   * 비로그인이면 보내지 않고 입력칸에 채운 뒤 로그인 안내를 띄운다. 위 effect(startNewChat)가 안내를 지운 뒤라 그 뒤에 둔다 —
   * StrictMode가 둘을 다시 돌려도 같은 값을 다시 채울 뿐이다
   */
  useEffect(() => {
    const handoffAsk = handoffAskRef.current
    if (handoffAsk === null || loggedIn) return
    handoffAskRef.current = { ...handoffAsk, sendable: false }
    setQuestion(handoffAsk.text)
    setNotice(LOGIN_HINT)
  }, [loggedIn])

  /*
   * 로그인했으면 대화방 목록이 온 뒤에 보낸다(못 받았어도 보낸다 — 목록 없이도 질문은 된다). 목록을 받는 중에 방을 만들면
   * 늦게 온 목록이 방금 만든 방을 목록에서 지운다
   */
  useEffect(() => {
    const handoffAsk = handoffAskRef.current
    if (handoffAsk === null || !loggedIn) return
    if (!handoffAsk.sendable) {
      handoffAskRef.current = null
      return
    }
    if (sessionsState === 'loading') return
    handoffAskRef.current = null
    submit(handoffAsk)
    // 로그인 여부와 목록 상태가 바뀔 때만 본다. submit은 그 순간의 화면 상태로 보낸다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, sessionsState])

  /*
   * 마이페이지 '최근 AI 대화'에서 왔으면 목록이 온 뒤 그 방을 연다(사이드바에서 누른 것과 같은 길 — handleSelect).
   * 목록을 못 받았어도 연다 — 방 하나는 목록 없이도 열린다. 지워진 방이면 handleSelect가 목록에서 빼고 알린다.
   * 비로그인이면 열지 않는다(대화는 계정의 것이다). ref라서 StrictMode가 effect를 두 번 돌려도 한 번만 연다
   */
  const openSessionRef = useRef(sessionHandoff)
  useEffect(() => {
    const roomId = openSessionRef.current
    if (roomId === null) return
    if (!loggedIn) {
      openSessionRef.current = null
      return
    }
    if (sessionsState === 'loading') return
    openSessionRef.current = null
    handleSelect(roomId)
    // 로그인 여부와 목록 상태가 바뀔 때만 본다. handleSelect는 그 순간의 화면 상태로 연다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, sessionsState])

  /*
   * 내 성향. 토큰이 없으면 부르지 않는다(성향 영역은 어차피 숨긴다). 만료된 토큰(401)이면 토큰만 지우고
   * 이 화면에 머문다. 못 불러온 것은 "없음"이 아니라 실패로 보인다(useMyPersonality)
   */
  const { personality, retry: retryPersonality } = useMyPersonality(loggedIn)

  function nextLocalId(): number {
    const id = localIdRef.current
    localIdRef.current -= 1
    return id
  }

  function startNewChat() {
    askSeqRef.current += 1
    roomSeqRef.current += 1
    setSessionId(null)
    setMessages([])
    setDetailState('idle')
    setPending(null)
    setNotice('')
  }

  /**
   * 목록에서 방을 뺀다. 보던 방이면 새 대화로 돌린다 — 번호가 올라가 그 방에 기다리던 답이 늦게 와도 버린다.
   * 없어진 방(다른 탭에서 지움·남의 방)이면 notice를 주어 알린다. 예전엔 removeRoom·dropRoom 둘이 거의 같은 일을 했다
   */
  function removeRoom(roomId: number, notice?: string) {
    setSessions((previous) => previous.filter((session) => session.sessionId !== roomId))
    if (roomId === sessionIdRef.current || notice !== undefined) startNewChat()
    if (notice !== undefined) setNotice(notice)
  }

  /**
   * 이름 바꾸기. 실패하면 던진다(사이드바가 이름칸을 두고 알린다). 다른 곳에서 지운 방이면 목록에서 빼고 'gone'이다.
   * 서버는 바꾼 시각을 최근 대화 시각으로도 적어 그 방이 맨 위로 간다 — 목록을 다시 받기 전에 먼저 맞춰 둔다.
   */
  async function handleRename(roomId: number, title: string): Promise<'renamed' | 'gone'> {
    try {
      const renamed = await renameSession(roomId, title)
      setSessions((previous) => [renamed, ...previous.filter((item) => item.sessionId !== roomId)])
      loadSessions(true)
      return 'renamed'
    } catch (error: unknown) {
      if (!isRoomGone(error)) throw error
      removeRoom(roomId)
      return 'gone'
    }
  }

  /**
   * 지우기. 실패하면 던진다(확인 상자가 알린다). 이미 없는 방(404)·남의 방(403)이면 지운 것과 같다.
   * 답을 기다리던 방도 지울 수 있다 — 서버는 답을 저장하다 실패하고(방이 없다), 화면은 새 대화로 돌아가 그 실패를 버린다.
   */
  async function handleDelete(roomId: number) {
    try {
      await deleteSession(roomId)
    } catch (error: unknown) {
      if (!isRoomGone(error)) throw error
    }
    removeRoom(roomId)
    loadSessions(true)
  }

  function handleSelect(selectedId: number) {
    // 보고 있는 세션을 또 누른 것뿐이다. 다시 받아올 이유가 없다
    if (selectedId === sessionId && detailState !== 'error') return

    askSeqRef.current += 1
    roomSeqRef.current += 1
    const seq = askSeqRef.current
    setSessionId(selectedId)
    setPending(null)
    setNotice('')
    setDetailState('loading')

    getSessionDetail(selectedId)
      .then((detail) => {
        // 받는 사이 다른 방이나 새 대화로 옮겼다
        if (seq !== askSeqRef.current) return
        setMessages(detail.messages)
        setDetailState('idle')
      })
      .catch((error: unknown) => {
        if (seq !== askSeqRef.current) return
        console.warn('AI 대화 조회 실패', error)
        // 다른 탭에서 지운 방이다. 다시 시도해도 같으니 목록에서 뺀다
        if (isRoomGone(error)) {
          removeRoom(selectedId, ROOM_GONE_HINT)
          return
        }
        setDetailState('error')
      })
  }

  /**
   * @param asked 방금 띄운 내 말풍선(submit이 만든다). 그만 기다린 방을 되살릴 때 서버 메시지 뒤에 다시 붙인다
   * @param options.synced 방을 이미 다시 받았다(handleRetry). 여기서 또 받지 않는다
   */
  async function send({ text, stockName }: Question, asked?: ChatMessage, options: { synced?: boolean } = {}) {
    lastAskRef.current = { text, stockName }
    // 그만 기다린 방이면 서버가 그 사이 끝낸 앞 답을 먼저 되살린다 — 안 그러면 새 답 뒤로 밀려 방을 다시 열기 전까지 안 보인다
    const wasStopped = pending === 'stopped' && options.synced !== true
    /*
     * 답이 온 뒤 대화방 목록을 다시 받을지. 서버는 방의 첫 질문으로만 제목을 짓는다 — 새로 만든 방이거나 아직 '새 대화'인 방이면
     * 받아서 지어진 제목을 쓰고, 아니면 그 방을 맨 위로 올리기만 한다(목록은 최근 대화 순). 예전엔 답마다 목록을 통째로 다시 받았다.
     * 목록에 그 방이 없어도(목록을 못 받았거나 아직 안 왔다) 다시 받는다 — 안 그러면 처음 목록이 실패한 화면은 끝까지 안 채워진다.
     */
    const answeredRoomInList = sessions.find((item) => item.sessionId === sessionId)
    const needsTitle =
      sessionId === null || answeredRoomInList === undefined || answeredRoomInList.title === DEFAULT_TITLE
    setPending('loading')
    askSeqRef.current += 1
    const seq = askSeqRef.current
    const roomSeq = roomSeqRef.current

    // 이 질문이 들어간 방. 실패하면 목록에서 뺄 때 쓴다
    let roomId = sessionId
    try {
      if (wasStopped && roomId !== null) {
        try {
          const detail = await getSessionDetail(roomId)
          if (seq !== askSeqRef.current) return
          setMessages(asked === undefined ? detail.messages : [...detail.messages, asked])
        } catch (error: unknown) {
          if (seq !== askSeqRef.current) return
          // 되살리지 못해도 질문은 보낸다. 앞 답은 방을 다시 열면 보인다
          console.warn('AI 대화 다시 확인 실패', error)
        }
      }

      /*
       * 새 대화면 방부터 만든다. 방 없이 물으면 서버가 방을 만들어 주지만, 답이 실패하면(502) 질문만 남은 그 방의 번호를
       * 몰라 다시 시도가 또 다른 방을 만든다. 만든 방은 곧바로 목록 맨 위에 올린다(제목은 첫 답 뒤에 서버 것으로 바뀐다).
       * 만드는 사이 그만 기다렸어도(askSeq가 올라감) 보던 자리가 새 대화 그대로면(roomSeq) 만든 방을 쓴다 —
       * 안 그러면 다시 시도가 방을 또 만들어 서버에 빈 '새 대화' 방이 남았다.
       */
      if (roomId === null) {
        const room = await createSession()
        if (roomSeq !== roomSeqRef.current) return
        roomId = room.sessionId
        setSessionId(room.sessionId)
        setSessions((previous) => [room, ...previous.filter((item) => item.sessionId !== room.sessionId)])
        if (seq !== askSeqRef.current) return
      }

      // 같은 방 번호를 실어 보내면 서버가 앞 대화를 맥락으로 쓴다("그 종목은?")
      // 종목명은 종목 상세에서 온 첫 질문만 싣는다. 나머지는 서버가 질문과 앞 대화에서 찾는다(api/ai.ts ask)
      const controller = new AbortController()
      abortRef.current = controller
      const result = await ask(text, roomId, stockName, controller.signal).finally(() => {
        if (abortRef.current === controller) abortRef.current = null
      })
      // 기다리는 사이 화면이 다른 대화방으로 바뀌었거나 그만 기다렸다. 이 답은 버린다
      if (seq !== askSeqRef.current) return

      // 답이 비어 오면 빈 말풍선을 남기지 않고 실패로 다룬다. '다시 시도'로 같은 질문을 다시 보낸다
      if (result.answer.trim() === '') {
        console.warn('AI 답이 비어 있습니다', result)
        setPending('error')
        return
      }

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
      if (needsTitle) {
        loadSessions(true)
      } else {
        const answeredRoom = roomId
        setSessions((previous) => {
          const room = previous.find((item) => item.sessionId === answeredRoom)
          return room === undefined
            ? previous
            : [room, ...previous.filter((item) => item.sessionId !== answeredRoom)]
        })
      }
    } catch (error: unknown) {
      if (seq !== askSeqRef.current) return
      console.warn('AI 질문 전송 실패', error)

      /*
       * 성향을 안 정한 회원은 서버가 404(MEMBER404_2)를 준다. 다시 보내 봐야 같은 답이라
       * '다시 시도'를 띄우지 않고 검사부터 하라고 안내한다.
       * 401은 client.ts가 이미 로그인 화면으로 보냈다.
       */
      if (error instanceof ApiError && error.code === 'MEMBER404_2') {
        setPending(null)
        setNotice(NO_PERSONALITY_HINT)
        return
      }
      if (roomId !== null && isRoomGone(error)) {
        removeRoom(roomId, ROOM_GONE_HINT)
        return
      }
      // 앞 질문의 답을 아직 만드는 중이다. 질문은 저장되지 않았으니 조금 뒤 다시 시도로 보낸다
      if (error instanceof ApiError && error.code === 'CHAT409_1') setNotice(BUSY_HINT)
      setPending('error')
    }
  }

  function handleSubmit() {
    // 입력칸으로 묻는 질문에는 종목명을 싣지 않는다
    submit({ text: question.trim(), stockName: null })
  }

  /** 질문을 띄우고 보낸다. 입력칸(handleSubmit)과 종목 상세에서 온 첫 질문이 같은 길을 탄다 */
  function submit({ text, stockName }: Question) {
    // 공백만 친 경우까지 걸러진다
    if (text === '' || pending === 'loading') return
    /*
     * 대화방 내용을 받는 중이거나 못 받았으면 보내지 않는다. 받는 중에 보내면 늦게 온 대화 내용이 방금 띄운
     * 질문과 답을 덮어써 둘 다 사라지고, 못 받은 화면에서 보내면 오류 안내가 먼저라 질문·답·그만 기다리기가 안 보인 채
     * 서버에만 저장됐다(2026-10-31). 입력칸의 글은 그대로 남는다.
     */
    if (detailState !== 'idle') return

    // 서버가 토큰 없는 요청을 401로 막는다. 보내 보고 실패하느니 먼저 알린다
    if (!loggedIn) {
      setNotice(LOGIN_HINT)
      return
    }

    /* 내 질문을 먼저 띄운다. 서버를 기다렸다 그리면 반응이 느리게 느껴진다 */
    const asked: ChatMessage = {
      messageId: nextLocalId(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((previous) => [...previous, asked])
    setQuestion('')
    setNotice('')

    void send({ text, stockName }, asked)
  }

  /**
   * 그만 기다리기. 답은 제한 없이 기다려서(서버가 영영 안 답하면 입력칸이 잠긴 채 남았다) 사용자가 끊을 수 있게 한다
   * (사용자 결정 2026-09-27). 번호를 올려 늦게 온 답은 버리고, 같은 질문은 다시 시도로 다시 보낸다.
   * 서버는 이미 받은 질문의 답을 계속 만들어 방에 저장한다 — 프론트가 요청을 거둘 방법은 없다.
   */
  function handleStop() {
    abortRef.current?.abort()
    askSeqRef.current += 1
    setPending('stopped')
  }

  /**
   * 다시 시도. 방이 있으면 먼저 방을 다시 받아, 서버가 그 질문의 답을 이미 저장했으면(그만 기다린 뒤 답이 끝났거나 409 뒤
   * 앞 답이 끝났다) 그걸 보여 주고 끝낸다 — 그냥 다시 보내면 같은 질문과 답이 방에 두 번 저장된다. 답이 없으면 다시 보낸다.
   */
  async function handleRetry() {
    const last = lastAskRef.current
    if (last === null) return
    if (sessionId === null) {
      void send(last)
      return
    }

    setPending('loading')
    askSeqRef.current += 1
    const seq = askSeqRef.current
    try {
      const detail = await getSessionDetail(sessionId)
      if (seq !== askSeqRef.current) return
      const [asked, answered] = detail.messages.slice(-2)
      if (
        asked?.role === 'user' &&
        asked.content === last.text &&
        answered?.role === 'assistant' &&
        answered.content.trim() !== ''
      ) {
        setMessages(detail.messages)
        setPending(null)
        setNotice('')
        loadSessions(true)
        return
      }
    } catch (error: unknown) {
      if (seq !== askSeqRef.current) return
      // 확인을 못 해도 다시 보내기는 한다
      console.warn('AI 대화 다시 확인 실패', error)
    }
    void send(last, undefined, { synced: true })
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
          listState={sessionsState}
          selectedId={sessionId}
          onSelect={handleSelect}
          onNewChat={startNewChat}
          onRename={handleRename}
          onDelete={handleDelete}
          onRetryList={() => loadSessions()}
          isLoggedIn={loggedIn}
        />

        <section className={styles.chat}>
          {detailState === 'loading' ? (
            <div className={styles.skeletonArea} aria-label="대화를 불러오는 중">
              <span className={`${styles.skeleton} ${styles.skeletonUser}`} />
              <span className={styles.skeleton} />
              <span className={`${styles.skeleton} ${styles.skeletonUser}`} />
              <span className={styles.skeleton} />
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
              <p className={styles.watermark}>JUBY</p>
              <p className={styles.watermarkSub}>AI 도우미</p>

              {/*
                성향이 있으면 보여주고, 로그인했는데 없으면 검사를 권한다 —
                성향 없는 회원의 질문은 서버가 거절하므로 미리 알려야 한다.
                못 불러왔으면 검사를 권하지 않는다(다시 검사하면 멀쩡한 성향을 덮어쓴다).
                비로그인·불러오는 중은 이 영역을 숨긴다. 지어낸 값을 보여줄 수는 없다.
              */}
              {personality.kind === 'found' ? (
                <div className={styles.personality}>
                  <p className={styles.personalityText}>
                    현재 당신의 투자성향은 ‘{personality.name}’입니다.
                  </p>
                  <Link className={styles.darkButton} to={PERSONALITY_TEST_URL}>
                    투자성향 변경하기
                  </Link>
                </div>
              ) : personality.kind === 'error' ? (
                <div className={styles.personality}>
                  <p className={styles.personalityText}>성향을 불러오지 못했어요.</p>
                  <button type="button" className={styles.darkButton} onClick={retryPersonality}>
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
                        onClick={() => {
                          setQuestion(example)
                          inputRef.current?.focus()
                        }}
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ) : personality.kind === 'none' ? (
                <div className={styles.personality}>
                  <p className={styles.personalityText}>
                    투자성향을 정하면 나에게 맞춘 답을 받을 수 있어요.
                  </p>
                  <Link className={styles.darkButton} to={PERSONALITY_TEST_URL}>
                    투자성향 검사하기
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <ChatMessages
              messages={messages}
              pending={pending}
              onRetry={() => void handleRetry()}
              onStop={handleStop}
            />
          )}

          {/*
            성향이 없다는 안내에는 갈 곳을 함께 준다. 검사 버튼은 말풍선이 하나도
            없을 때만 보이는 자리에 있어서, 질문을 보낸 뒤에는 화면에서 사라진다.
          */}
          {notice !== '' && (
            <p className={styles.notice}>
              {notice}
              {notice === NO_PERSONALITY_HINT && (
                <Link className={styles.noticeLink} to={PERSONALITY_TEST_URL}>
                  투자성향 검사하기
                </Link>
              )}
            </p>
          )}

          <div className={styles.composer}>
            <div className={styles.composerBox}>
              <textarea
                ref={inputRef}
                className={styles.input}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="예: 삼성전자 주가 어때?"
                rows={1}
                maxLength={QUESTION_MAX_LENGTH}
                disabled={pending === 'loading'}
                aria-label="질문 입력"
              />
              <button
                type="button"
                className={styles.send}
                onClick={handleSubmit}
                disabled={
                  pending === 'loading' ||
                  detailState !== 'idle' ||
                  question.trim() === ''
                }
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
