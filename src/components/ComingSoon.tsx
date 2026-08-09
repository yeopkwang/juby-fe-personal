import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import styles from './ComingSoon.module.css'

interface Props {
  title: string
  /** 무엇이 준비중인지 한두 줄. 막다른 화면일수록 이유가 있어야 덜 답답하다 */
  description: ReactNode
}

/** 아직 만들지 않은 화면이 공통으로 쓰는 안내 */
export default function ComingSoon({ title, description }: Props) {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>

      <Link to="/" className={styles.home}>
        홈으로 돌아가기
      </Link>
    </div>
  )
}
