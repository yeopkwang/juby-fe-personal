import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../components/Modal'
import Skeleton from '../components/Skeleton'
import { deleteMember, getMemberInfo, updateMemberInfo } from '../api/member'
import { clearTokens } from '../utils/auth'
import { formatBirth } from '../utils/format'
import { toDashedYmd, toYmd } from '../utils/date'
import type { MemberInfo } from '../types/member'
import styles from './MypageProfilePage.module.css'

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
  const navigate = useNavigate()

  const [state, setState] = useState<State>({ kind: 'loading' })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBirth, setEditBirth] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [editError, setEditError] = useState('')

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
      /*
       * 토큰을 지우면 헤더와 마이페이지 껍데기가 함께 알아차린다(utils/auth.ts가 알려준다).
       * 예전에는 헤더가 로그인 여부를 한 번만 읽어서 주소창을 통째로 바꿔야 했다.
       *
       * 순서가 중요하다. 지우기 전에 화면을 옮기면 그 찰나에 마이페이지가
       * 아직 로그인 상태로 보여 API를 한 번 더 부른다.
       */
      clearTokens()
      navigate('/', { replace: true })
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

  /**
   * 지금 값을 채워 넣고 연다.
   * 빈 칸에서 시작하면 "지우고 새로 쓰는" 화면이 되는데, 사용자가 원하는 건 보통
   * 한 글자 고치는 것이다. 생년월일이 없는 계정은 빈 칸으로 시작한다.
   */
  function openEdit(current: MemberInfo) {
    setEditName(current.name)
    setEditBirth(current.birth ?? '')
    setEditError('')
    setIsEditOpen(true)
  }

  function closeEdit() {
    if (isSaving) return
    setIsEditOpen(false)
    setEditError('')
  }

  async function handleSave() {
    const name = editName.trim()

    /*
     * 서버와 같은 기준으로 먼저 거른다. 서버도 막아 주지만 그때는 400 한 줄이라
     * 무엇이 잘못됐는지 알기 어렵고, 다녀오는 시간도 그냥 버려진다.
     */
    if (name.length < 2 || name.length > 4) {
      setEditError('이름은 2~4자로 입력해 주세요.')
      return
    }
    if (editBirth && editBirth > toDashedYmd(toYmd(new Date()))) {
      setEditError('생년월일은 오늘 이전으로 입력해 주세요.')
      return
    }

    setIsSaving(true)
    setEditError('')

    try {
      /*
       * 생년월일을 비워 두면 아예 보내지 않는다. 서버가 null인 항목은 건드리지 않으므로
       * (Member.updateInfo) 지금 값이 그대로 남는다. 빈 문자열을 보내면 400이다.
       */
      await updateMemberInfo(name, editBirth)
      setIsEditOpen(false)
      // 응답이 수정 시각뿐이라 화면에 채울 값이 없다. 저장된 값을 다시 받아 온다
      load()
    } catch (error: unknown) {
      console.warn('회원 정보 수정 실패', error)
      setEditError('수정하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsSaving(false)
    }
  }

  if (state.kind === 'loading') {
    return <Skeleton className={styles.skeleton} label="불러오는 중" />
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
        {/*
          늘 기본 그림이다. 프로필 사진을 주는 곳이 아무 데도 없다 —
          명세의 내 정보 조회는 name·birth·email 셋뿐이고, 백엔드 Member 엔티티에도
          이미지 필드가 없다. 소셜 응답에서 꺼내는 코드는 있지만 저장하지 않고 버린다.
          서버가 주기 시작하면 여기서 갈라 주면 된다.
        */}
        <DefaultAvatar />

        <p className={styles.name}>{member.name}</p>
        {/* 소셜에서 생년월일을 못 받은 계정이 있다. 그때는 줄을 지우지 않고 없다고 적는다 */}
        <p className={styles.field}>{birth ?? '생년월일 정보 없음'}</p>
        <p className={styles.field}>{member.email}</p>

        <div className={styles.buttons}>
          <button
            type="button"
            className={styles.muted}
            onClick={() => openEdit(member)}
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

      </div>

      {/* 이름과 생년월일만 고칠 수 있다. 이메일·가입경로는 소셜 계정에서 온 값이다 */}
      <Modal isOpen={isEditOpen} onClose={closeEdit}>
        <p className={styles.modalTitle}>내 정보 수정</p>

        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            void handleSave()
          }}
        >
          <label className={styles.formLabel} htmlFor="mypage-name">
            이름
          </label>
          <input
            id="mypage-name"
            className={styles.input}
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            maxLength={4}
            disabled={isSaving}
            autoComplete="name"
          />
          <p className={styles.formHint}>2~4자로 입력해 주세요.</p>

          <label className={styles.formLabel} htmlFor="mypage-birth">
            생년월일
          </label>
          <input
            id="mypage-birth"
            className={styles.input}
            type="date"
            value={editBirth}
            /* 달력에서 미래 날짜를 아예 못 고르게 막는다. 서버도 오늘 이전만 받는다 */
            max={toDashedYmd(toYmd(new Date()))}
            onChange={(event) => setEditBirth(event.target.value)}
            disabled={isSaving}
          />
          {member.birth === null && (
            <p className={styles.formHint}>
              소셜 계정에서 생년월일을 받지 못했어요. 직접 입력하면 저장됩니다.
            </p>
          )}

          {editError && (
            <p className={styles.modalError} role="alert">
              {editError}
            </p>
          )}

          <div className={styles.modalButtons}>
            <button type="submit" className={styles.save} disabled={isSaving}>
              {isSaving ? '저장 중…' : '저장하기'}
            </button>
            <button
              type="button"
              className={styles.cancel}
              onClick={closeEdit}
              disabled={isSaving}
            >
              취소
            </button>
          </div>
        </form>
      </Modal>

      {/* 탈퇴는 되돌릴 수 없다. 버튼 하나로 바로 지우지 않는다 */}
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        <p className={styles.modalTitle}>정말 탈퇴하시겠습니까?</p>
        <p className={styles.modalText}>
          계정과 투자성향 정보가 모두 삭제되며 복구할 수 없습니다.
        </p>

        {deleteError && (
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
