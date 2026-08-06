import { useState } from 'react'
import type { NewsItem } from '../types/market'
import { formatRelativeTime } from '../utils/format'
import styles from './NewsList.module.css'

/**
 * 최신순은 화면에서 직접 정렬하고, 관련도순은 백엔드가 준 순서를 그대로 쓴다.
 * 다만 `/api/news`가 sort 파라미터를 무시하고 늘 최신순 20건만 주고 있어서
 * 지금은 두 순서가 같게 나온다. 백엔드가 sort를 받기 시작하면 그때 갈린다.
 */
type SortKey = 'date' | 'sim'

const TABS: { key: SortKey; label: string }[] = [
  { key: 'date', label: '최신순' },
  { key: 'sim', label: '관련도순' },
]

interface Props {
  news: NewsItem[]
}

export default function NewsList({ news }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('date')

  const sorted =
    sortKey === 'sim'
      ? news
      : [...news].sort(
          (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
        )

  return (
    <>
      <div className={styles.headingRow}>
        <h2 className={styles.heading}>뉴스 모아보기</h2>

        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={
                sortKey === tab.key
                  ? `${styles.tab} ${styles.tabActive}`
                  : styles.tab
              }
              onClick={() => setSortKey(tab.key)}
              aria-pressed={sortKey === tab.key}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 && (
        <p className={styles.empty}>관련 뉴스를 찾지 못했습니다.</p>
      )}

      <ul className={styles.list}>
        {sorted.map((item) => (
          <li key={item.link}>
            <a
              className={styles.card}
              href={item.link}
              target="_blank"
              rel="noreferrer"
            >
              <p className={styles.meta}>
                {item.source}
                <span className={styles.dot}>·</span>
                {formatRelativeTime(item.publishedAt)}
              </p>
              <p className={styles.title}>{item.title}</p>
              <p className={styles.description}>{item.description}</p>
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}
