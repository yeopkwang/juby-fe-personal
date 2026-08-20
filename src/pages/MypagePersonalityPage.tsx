import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PersonalityCard from '../components/PersonalityCard'
import Skeleton from '../components/Skeleton'
import { changeMyPersonality, getMyPersonality } from '../api/member'
import {
  PERSONALITY_IDS,
  PERSONALITY_INFO,
  PERSONALITY_ORDER,
} from '../utils/personality'
import type { PersonalityInfo } from '../types/member'
import type { PersonalityType } from '../types/personality'
import styles from './MypagePersonalityPage.module.css'

/**
 * 검사를 마치면 PersonalityResultPage의 doneRoute가 from=mypage를 보고 여기로 돌려보낸다.
 */
const TEST_URL = '/personality-test?from=mypage'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; info: PersonalityInfo }
  /** 아직 검사하지 않은 회원. 서버가 404 MEMBER404_2로 알려준다 */
  | { kind: 'none' }
  | { kind: 'error' }

/**
 * '직접 고르기'를 누른 뒤의 상태.
 *
 * `done`이 **고른 것(picked)과 저장된 것(saved)을 따로 들고 있는 것이 핵심이다.**
 * 둘은 같아야 정상이지만, personalityId 표가 추정이라 어긋날 수 있다
 * (utils/personality.ts의 PERSONALITY_IDS 주석). 하나로 합쳐 두면 어긋나도 알 수 없다.
 */
type Change =
  | { kind: 'idle' }
  | { kind: 'saving'; picked: PersonalityType }
  | { kind: 'done'; picked: PersonalityType; saved: PersonalityType }
  | { kind: 'failed' }

export default function MypagePersonalityPage() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [change, setChange] = useState<Change>({ kind: 'idle' })

  const load = useCallback(() => {
    setState({ kind: 'loading' })
    setChange({ kind: 'idle' })

    getMyPersonality()
      .then((info) =>
        setState(info === null ? { kind: 'none' } : { kind: 'ready', info }),
      )
      .catch((error: unknown) => {
        console.warn('투자성향 조회 실패', error)
        setState({ kind: 'error' })
      })
  }, [])

  useEffect(load, [load])

  /*
   * 성향을 바꾸고 **반드시 다시 조회한다.**
   *
   * 서버 응답은 수정 시각뿐이라 무엇으로 바뀌었는지 말해 주지 않는다. 그래서 보낸 번호가
   * 맞았다고 가정하고 "○○형으로 바뀌었습니다"를 띄우면, 표가 틀렸을 때 사용자는 엉뚱한
   * 성향이 저장된 줄도 모른 채 성공 문구만 본다. 되물어서 서버가 말하는 이름을 그대로
   * 보여주면, 틀려도 화면에 드러난다.
   *
   * 조회가 한 번 더 나가는 값은 치른다. 자주 누르는 버튼이 아니다.
   */
  async function handlePick(picked: PersonalityType) {
    if (change.kind === 'saving') return

    setChange({ kind: 'saving', picked })
    try {
      await changeMyPersonality(PERSONALITY_IDS[picked])

      const info = await getMyPersonality()
      if (info === null) {
        // 바꿨는데 성향이 없다고 나온다. 성공했다고 말할 수 없는 상태다
        setState({ kind: 'none' })
        setChange({ kind: 'failed' })
        return
      }

      setState({ kind: 'ready', info })
      setChange({ kind: 'done', picked, saved: info.investPersonality })
    } catch (error: unknown) {
      console.warn('투자성향 변경 실패', error)
      setChange({ kind: 'failed' })
    }
  }

  if (state.kind === 'loading') {
    return <Skeleton className={styles.skeleton} label="불러오는 중" />
  }

  if (state.kind === 'error') {
    return (
      <div className={styles.message}>
        <p className={styles.messageText}>투자성향을 불러오지 못했습니다.</p>
        {/*
          백엔드가 /api/**를 permitAll로 열어둬서 인증이 풀려도 401이 아니라 500이 온다.
          로그인 화면으로 튕겨내는 대신 다시 로그인하라고 알려만 준다.
        */}
        <p className={styles.hint}>
          로그인이 풀렸을 수 있어요. 문제가 계속되면 다시 로그인해 주세요.
        </p>
        <button type="button" className={styles.primary} onClick={load}>
          다시 시도
        </button>
      </div>
    )
  }

  /*
   * 검사 전이어도 직접 고르기는 내놓는다. 오히려 이 사람에게 제일 쓸모 있다 —
   * 이미 자기 성향을 아는 사람은 열 문항을 풀 이유가 없다.
   */
  if (state.kind === 'none') {
    return (
      <div className={styles.wrap}>
        <div className={styles.message}>
          <p className={styles.messageText}>
            아직 투자성향 검사를 하지 않았습니다
          </p>
          <p className={styles.hint}>
            열 문항이면 끝나요. 검사하고 나면 여기에 결과가 남습니다.
          </p>
          <a className={styles.primary} href={TEST_URL}>
            검사하러 가기
          </a>
        </div>

        <PersonalityPicker
          current={null}
          change={change}
          onPick={handlePick}
        />
      </div>
    )
  }

  const { info } = state
  /* 서버 값이 먼저다. personality 테이블이 비어 있으면 빈 문자열이 오므로 로컬 문구로 받친다 */
  const fallback = PERSONALITY_INFO[info.investPersonality]

  return (
    <div className={styles.wrap}>
      <PersonalityCard
        type={info.investPersonality}
        description={info.description || fallback.description}
        imageUrl={info.personalityImg || fallback.imageUrl}
      >
        <Link to={TEST_URL} className={styles.retest}>
          검사 다시하기
        </Link>
      </PersonalityCard>

      <PersonalityPicker
        current={info.investPersonality}
        change={change}
        onPick={handlePick}
      />
    </div>
  )
}

interface PickerProps {
  /** 지금 저장된 성향. 아직 검사 전이면 null */
  current: PersonalityType | null
  change: Change
  onPick: (picked: PersonalityType) => void
}

/** 다섯 성향을 늘어놓고 누르면 바로 바꾼다 */
function PersonalityPicker({ current, change, onPick }: PickerProps) {
  const isSaving = change.kind === 'saving'

  return (
    <section className={styles.picker}>
      <h3 className={styles.pickerTitle}>검사 없이 직접 고르기</h3>
      <p className={styles.pickerHint}>
        이미 아는 성향이 있다면 문항을 풀지 않고 바로 바꿀 수 있어요.
      </p>

      {/*
        위험이 낮은 쪽부터 높은 쪽으로 늘어놓는다(PERSONALITY_ORDER). 순서 자체가
        "오른쪽으로 갈수록 공격적"이라는 정보라, 이름만 읽어도 자리를 짐작할 수 있다.
      */}
      <ul className={styles.options}>
        {PERSONALITY_ORDER.map((type) => {
          const isCurrent = type === current
          return (
            <li key={type}>
              <button
                type="button"
                className={
                  isCurrent
                    ? `${styles.option} ${styles.optionCurrent}`
                    : styles.option
                }
                /* 같은 값으로 바꾸는 건 요청만 나가고 달라지는 게 없다 */
                disabled={isCurrent || isSaving}
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => onPick(type)}
              >
                {type}
                {isCurrent && <span className={styles.badge}>지금</span>}
              </button>
            </li>
          )
        })}
      </ul>

      {/* 되물어서 확인하는 동안. 두 번 요청이 나가므로 잠깐 걸린다 */}
      <p className={styles.status} role="status">
        {change.kind === 'saving' && `${change.picked}으로 바꾸는 중…`}

        {change.kind === 'failed' &&
          '성향을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.'}

        {/* 서버가 말한 이름이 고른 것과 같다. 정상 */}
        {change.kind === 'done' &&
          change.picked === change.saved &&
          `${change.saved}으로 바꿨습니다.`}
      </p>

      {/*
        고른 것과 저장된 것이 다르다. **번호 표(PERSONALITY_IDS)가 틀렸다는 뜻이다.**
        성공으로 넘기면 사용자는 엉뚱한 성향을 자기 것으로 믿게 되므로 그대로 말한다.
        이 문구가 뜨면 백엔드에 `SELECT id, invest_personality FROM personality;`를
        받아 PERSONALITY_IDS를 고쳐야 한다.
      */}
      {change.kind === 'done' && change.picked !== change.saved && (
        <p className={styles.mismatch} role="alert">
          <strong className={styles.mismatchTitle}>
            고른 것과 다르게 저장됐습니다
          </strong>
          {change.picked}을(를) 골랐는데 서버에는 {change.saved}으로 저장됐어요.
          성향 번호가 어긋나 있습니다. 개발자에게 알려 주세요.
        </p>
      )}
    </section>
  )
}
