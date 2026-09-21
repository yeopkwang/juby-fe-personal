import { useEffect, useState } from 'react'
import { getGuideSections } from '../api/guide'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import type { GuideSection } from '../types/guide'
import styles from './GuidePage.module.css'

export default function GuidePage() {
  useDocumentTitle('사용설명서')
  const [sections, setSections] = useState<GuideSection[] | null>(null)

  useEffect(() => {
    /*
     * 지금은 mock이라 실패할 일이 없지만, DB를 붙이면 실패할 수 있다.
     * 그때도 설명서 때문에 화면이 비지 않도록 빈 목록으로 받는다.
     */
    getGuideSections()
      .catch(() => [])
      .then(setSections)
  }, [])

  return (
    <>
      <h1 className={styles.title}>JUBY 사용설명서</h1>

      {sections === null ? (
        <div className={styles.skeleton} aria-label="불러오는 중" />
      ) : (
        <ol className={styles.list}>
          {sections.map((section, index) => (
            <li key={section.guideId} className={styles.item}>
              <div className={styles.head}>
                {/* 번호를 글로 적어야 목차 순서가 화면 폭과 무관하게 유지된다 */}
                <span className={styles.number}>{index + 1}</span>
                <h2 className={styles.itemTitle}>{section.title}</h2>
              </div>

              {section.body.map((paragraph) => (
                <p key={paragraph} className={styles.body}>
                  {paragraph}
                </p>
              ))}
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
