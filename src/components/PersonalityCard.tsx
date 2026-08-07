import type { ReactNode } from 'react'
import type { PersonalityType } from '../types/personality'
import styles from './PersonalityCard.module.css'

interface Props {
  type: PersonalityType
  description: string
  imageUrl: string
  /** 카드 아래 버튼. 결과 화면은 '검사 다시하기', 마이페이지는 다른 걸 넣는다 */
  children?: ReactNode
}

export default function PersonalityCard({
  type,
  description,
  imageUrl,
  children,
}: Props) {
  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>당신의 투자성향은?</p>
      {/* 성향 이름이 바로 아래 글자로 나오므로 이미지에는 설명을 붙이지 않는다 */}
      <img className={styles.image} src={imageUrl} alt="" />
      <h2 className={styles.type}>{type}</h2>
      <p className={styles.description}>{description}</p>
      {children}
    </section>
  )
}
