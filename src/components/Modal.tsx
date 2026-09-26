import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import styles from './Modal.module.css'

interface Props {
  isOpen: boolean
  onClose: () => void
  /**
   * 상자 안 제목과 같은 뜻의 짧은 이름. 모달이 열린 순간 보조기기가 이걸 먼저 읽는다.
   * 상자 안 제목을 id로 가리키지 않은 건 제목 문단이 있는 모달과 없는 모달이 섞여서다.
   */
  label: string
  children: ReactNode
}

/** 상자 안에서 탭으로 닿을 수 있는 것들. 잠긴 버튼은 순서에서 빠진다 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ isOpen, onClose, label, children }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)

  /*
   * onClose를 ref에 옮겨 담아 아래 effect의 의존성에서 뺀다.
   * 부르는 세 곳 모두 렌더마다 새 함수를 넘기는데, 그대로 의존성에 넣으면 이름칸에
   * 글자 하나 칠 때마다 effect가 풀렸다 다시 걸려 포커스가 입력칸 밖으로 튕긴다.
   */
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  /*
   * 배경에서 누르기 시작했는가. 상자 안에서 누른 채 끌다가 배경에서 떼면 크롬은 click을
   * 누른 자리와 뗀 자리의 공통 조상인 배경에 보낸다. 그걸 닫기로 받으면 쓰던 내용이 날아간다.
   */
  const pressedOnBackdrop = useRef(false)

  useEffect(() => {
    if (!isOpen) return

    // 닫은 뒤 포커스를 돌려줄 자리. 대개 모달을 연 그 버튼이다
    const opener = document.activeElement
    const { body } = document

    /*
     * 뒤 배경이 같이 스크롤되면 모달을 읽는 중에 화면이 통째로 움직인다.
     * 스크롤바가 사라지며 생기는 가로 빈칸은 그만큼 오른쪽 여백으로 메운다.
     * 막대가 자리를 차지하지 않는 환경(맥의 겹침 스크롤바)에서는 0이라 아무 일도 없다.
     */
    const prevOverflow = body.style.overflow
    const prevPadding = body.style.paddingRight
    const barWidth = window.innerWidth - document.documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (barWidth > 0) body.style.paddingRight = `${barWidth}px`

    /*
     * 포커스를 첫 버튼이 아니라 상자 자체로 옮긴다.
     * 탈퇴 모달의 첫 버튼이 '탈퇴하기'라, 거기에 두면 엔터 한 번에 계정이 지워진다.
     * 상자에 두면 보조기기가 위 label부터 읽고 탭을 눌러야 버튼에 닿는다.
     */
    boxRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const box = boxRef.current
      if (box === null) return

      // 누를 때마다 다시 센다. 저장 중에는 입력칸과 버튼이 잠겨 대상이 줄어든다
      const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const first = items[0]
      const last = items.at(-1)
      if (first === undefined || last === undefined) {
        // 닿을 게 하나도 없는 모달이면 탭으로 빠져나가지도 못하게 막는다
        event.preventDefault()
        return
      }

      const active = document.activeElement
      if (event.shiftKey) {
        // 상자 자체에 포커스가 있을 때 거꾸로 가면 머리글 메뉴로 새어 나간다
        if (active === first || active === box) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      body.style.overflow = prevOverflow
      body.style.paddingRight = prevPadding
      /*
       * 탈퇴처럼 모달을 닫으면서 화면을 떠나는 경우엔 그 버튼이 이미 사라져 있다.
       * 떨어져 나간 요소에 focus()를 불러도 아무 일도 일어나지 않아 그냥 부른다.
       */
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        pressedOnBackdrop.current = event.target === event.currentTarget
      }}
      onClick={() => {
        if (pressedOnBackdrop.current) onClose()
      }}
    >
      {/* 박스 안쪽 클릭까지 배경으로 전달되면 모달이 바로 닫힌다 */}
      <div
        ref={boxRef}
        className={styles.box}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        // 포커스를 받아 두려고만 쓴다. -1이라 탭 순서에는 끼지 않는다
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
