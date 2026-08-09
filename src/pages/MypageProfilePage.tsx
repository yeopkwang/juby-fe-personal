import { useCallback, useEffect, useState } from 'react'
import Modal from '../components/Modal'
import { deleteMember, getMemberInfo } from '../api/member'
import { clearTokens } from '../utils/auth'
import { formatBirth } from '../utils/format'
import type { MemberInfo, ProfileImageUrl } from '../types/member'
import styles from './MypageProfilePage.module.css'

/**
 * 프로필 사진 주소. 지금은 언제나 null이라 기본 아이콘이 나간다.
 *
 * 백엔드 Member 엔티티에 이미지 필드가 없어서 저장된 값 자체가 없다.
 * 필드가 생기면 이 상수를 memberInfo의 값으로 바꾸기만 하면 아래 화면은 그대로 붙는다.
 */
const PROFILE_IMAGE_URL: ProfileImageUrl = null

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; member: MemberInfo }
  | { kind: 'error' }

/** 저장된 사진이 없을 때 쓰는 기본 아이콘 */
function DefaultAvatar() {
  return (
    <svg className={styles.avatar} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <clipPath id="mypageAvatarClip">
          <circle cx="60" cy="60" r="58" />
        </clipPath>
      </defs>
      <circle
        cx="60"
        cy="60"
        r="58"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* 머리와 어깨가 원 밖으로 나가지 않도록 원 모양으로 잘라낸다 */}
      <g clipPath="url(#mypageAvatarClip)" fill="currentColor">
        <circle cx="60" cy="48" r="20" />
        <ellipse cx="60" cy="112" rx="34" ry="30" />
      </g>
    </svg>
  )
}

export default function MypageProfilePage() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [editNotice, setEditNotice] = useState('')

  const load = useCallback(() => {
    setState({ kind: 'loading' })

    getMemberInfo()
      .then((member) => setState({ kind: 'ready', member }))
      .catch((error: unknown) => {
        console.warn('회원 정보 조회 실패', error)
        setState({ kind: 'error' })
      })
  }, [])

  useEffect(load, [load])

  async function handleDelete() {
    setIsDeleting(true)
    setDeleteError('')

    try {
      await deleteMember()
      clearTokens()
      /*
       * 헤더는 그려질 때 isLoggedIn()을 한 번 읽을 뿐이라
       * 주소창을 통째로 바꿔야 우측이 '로그인'으로 돌아온다(api/auth.ts의 logout과 같은 이유).
       */
      window.location.href = '/'
    } catch (error: unknown) {
      console.warn('회원 탈퇴 실패', error)
      // 실패했으면 토큰은 그대로 둔다. 지웠는데 계정이 남으면 로그인만 풀린 꼴이 된다
      setDeleteError('탈퇴하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setIsDeleting(false)
    }
  }

  function closeModal() {
    if (isDeleting) return
    setIsModalOpen(false)
    setDeleteError('')
  }

  if (state.kind === 'loading') {
    return <div className={styles.skeleton} aria-label="불러오는 중" />
  }

  if (state.kind === 'error') {
    return (
      <div className={styles.message}>
        <p className={styles.messageText}>회원 정보를 불러오지 못했습니다.</p>
        {/* permitAll 설정 탓에 인증이 풀려도 401이 아니라 500이 온다 */}
        <p className={styles.hint}>
          로그인이 풀렸을 수 있어요. 문제가 계속되면 다시 로그인해 주세요.
        </p>
        <button type="button" className={styles.primary} onClick={load}>
          다시 시도
        </button>
      </div>
    )
  }

  const { member } = state
  const birth = formatBirth(member.birth)

  return (
    <>
      <div className={styles.profile}>
        {PROFILE_IMAGE_URL === null ? (
          <DefaultAvatar />
        ) : (
          <img className={styles.avatar} src={PROFILE_IMAGE_URL} alt="" />
        )}

        <p className={styles.name}>{member.name}</p>
        {/* 소셜에서 생년월일을 못 받은 계정이 있다. 그때는 줄을 지우지 않고 없다고 적는다 */}
        <p className={styles.field}>{birth ?? '생년월일 정보 없음'}</p>
        <p className={styles.field}>{member.email}</p>

        <div className={styles.buttons}>
          {/*
            PATCH /api/members/me는 서버에 있지만 이번 범위에서 뺐다.
            수정 폼 UI가 Figma에 없어 화면 설계가 먼저 정해져야 한다.
          */}
          <button
            type="button"
            className={styles.muted}
            onClick={() => setEditNotice('준비 중입니다')}
          >
            정보 수정하기
          </button>
          <button
            type="button"
            className={styles.outline}
            onClick={() => setIsModalOpen(true)}
          >
            회원 탈퇴하기
          </button>
        </div>

        {editNotice !== '' && (
          <p className={styles.notice} role="status">
            {editNotice}
          </p>
        )}
      </div>

      {/* 탈퇴는 되돌릴 수 없다. 버튼 하나로 바로 지우지 않는다 */}
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        <p className={styles.modalTitle}>정말 탈퇴하시겠습니까?</p>
        <p className={styles.modalText}>
          계정과 투자성향 정보가 모두 삭제되며 복구할 수 없습니다.
        </p>

        {deleteError !== '' && (
          <p className={styles.modalError} role="alert">
            {deleteError}
          </p>
        )}

        <div className={styles.modalButtons}>
          <button
            type="button"
            className={styles.danger}
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? '처리 중…' : '탈퇴하기'}
          </button>
          <button
            type="button"
            className={styles.cancel}
            onClick={closeModal}
            disabled={isDeleting}
          >
            취소
          </button>
        </div>
      </Modal>
    </>
  )
}
