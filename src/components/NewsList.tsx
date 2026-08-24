import { useEffect, useState } from 'react'
import LoadFailure from './LoadFailure'
import { getStockNews } from '../api/stock'
import { isRetryable, toUserMessage } from '../utils/error'
import type { NewsSort, StockNewsItem } from '../types/stock'
import styles from './NewsList.module.css'

/**
 * 뉴스 모아보기.
 *
 * 정렬을 화면에서 하지 않는다. 탭을 누르면 그 순서로 서버에 다시 물어본다.
 * 관련도(RELEVANCE)는 Pinecone 벡터 유사도라 화면이 흉내 낼 수 있는 값이 아니다.
 */

const TABS: { key: NewsSort; label: string }[] = [
  { key: 'LATEST', label: '최신순' },
  { key: 'RELEVANCE', label: '관련도순' },
]

/** 백엔드가 후보 100건을 10건씩 준다. page는 0~9이고 넘기면 400이 온다 */
const PAGE_SIZE = 10
const MAX_PAGE = 9

/** 언론사명이 응답에 없어 링크 도메인으로 대신한다 */
function toSource(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '')
  } catch {
    return '출처 미상'
  }
}

interface Props {
  stockCode: string
}

export default function NewsList({ stockCode }: Props) {
  const [sort, setSort] = useState<NewsSort>('LATEST')
  const [page, setPage] = useState(0)
  const [items, setItems] = useState<StockNewsItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  /** 못 불러왔을 때 화면에 적을 한 문장. 성공했으면 null */
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [canRetry, setCanRetry] = useState(false)
  /** '다시 시도'를 누른 횟수. 올리면 아래 effect가 같은 길로 한 번 더 돈다 */
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let isStale = false
    setIsLoading(true)
    setErrorMessage(null)

    getStockNews(stockCode, sort, page)
      .then((result) => {
        if (isStale) return
        // 첫 장은 갈아끼우고, '더 보기'로 받은 장은 뒤에 잇는다
        setItems((previous) =>
          page === 0 ? result.newsList : [...previous, ...result.newsList],
        )
        setTotalCount(result.totalCount)
      })
      .catch((error: unknown) => {
        if (isStale) return
        console.warn('뉴스 조회 실패', error)
        setErrorMessage(toUserMessage(error, '관련 뉴스를 찾지 못했습니다'))
        setCanRetry(isRetryable(error))
      })
      .finally(() => {
        if (!isStale) setIsLoading(false)
      })

    return () => {
      isStale = true
    }
  }, [stockCode, sort, page, retryCount])

  /*
   * 정렬이 바뀌면 순서가 달라지므로 이어 붙이지 않고 첫 장부터 다시 받는다.
   *
   * 여기서 목록을 비우지 않는다. setItems([])로 비웠더니 문서 높이가 2562 → 1102로
   * 무너지면서 브라우저가 스크롤을 700 → 202로 끌어올렸다. 응답이 오면 700으로
   * 되돌아오지만 그 사이 1~2초 동안 차트가 보여서 "누를 때마다 차트로 올라간다"로
   * 느껴졌다. 이전 목록을 그대로 두면 높이가 유지돼 그 일이 없다(A/B로 실측).
   */
  function handleTabClick(key: NewsSort) {
    if (key === sort) return
    setPage(0)
    setSort(key)
  }

  /** 같은 정렬·같은 장을 한 번 더 물어본다 */
  function handleRetry() {
    setRetryCount((count) => count + 1)
  }

  const hasMore = page < MAX_PAGE && (page + 1) * PAGE_SIZE < totalCount

  /*
   * 정렬을 바꾸는 중. 첫 장을 받으면서 화면에는 이전 목록이 아직 남아 있는 상태다.
   * ('더 보기'는 뒤에 이어 붙이는 것이라 여기 해당하지 않는다 — page가 0이 아니다.)
   * 목록을 그대로 두면 멈춘 것처럼 보이므로 잠깐 흐려서 바뀌는 중임을 알린다.
   */
  const isSwitching = isLoading && page === 0 && items.length > 0

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
                sort === tab.key
                  ? `${styles.tab} ${styles.tabActive}`
                  : styles.tab
              }
              onClick={() => handleTabClick(tab.key)}
              aria-pressed={sort === tab.key}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/*
        '더 보기'를 눌렀다가 실패한 경우에는 이미 받아 둔 기사가 화면에 남아 있다.
        그 위에 안내를 얹어도 앞의 기사들은 그대로 읽을 수 있다.
      */}
      {errorMessage !== null && (
        <LoadFailure
          message={errorMessage}
          onRetry={canRetry ? handleRetry : undefined}
          isRetrying={isLoading}
        />
      )}

      {errorMessage === null && isLoading && items.length === 0 && (
        <p className={styles.empty}>불러오는 중…</p>
      )}

      {errorMessage === null && !isLoading && items.length === 0 && (
        <p className={styles.empty}>관련 뉴스를 찾지 못했습니다.</p>
      )}

      <ul
        className={isSwitching ? `${styles.list} ${styles.listBusy}` : styles.list}
        aria-busy={isSwitching}
      >
        {items.map((item) => (
          <li key={item.originalLink}>
            <a
              className={styles.card}
              href={item.originalLink}
              target="_blank"
              rel="noreferrer"
            >
              <p className={styles.meta}>
                {toSource(item.originalLink)}
                <span className={styles.dot}>·</span>
                {/* "2시간 전"은 백엔드가 계산해서 준다 */}
                {item.timeAgo}
              </p>
              <p className={styles.title}>{item.title}</p>
              <p className={styles.description}>{item.description}</p>
            </a>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          type="button"
          className={styles.more}
          onClick={() => setPage(page + 1)}
          disabled={isLoading}
        >
          {isLoading ? '불러오는 중…' : '뉴스 더 보기'}
        </button>
      )}
    </>
  )
}
