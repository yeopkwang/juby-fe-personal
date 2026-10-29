import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { COMMUNITY_PREVIEW_POSTS } from '../content/communityPreview'
import { HOME_GUIDE_INTRO, HOME_GUIDE_STEPS } from '../content/homeGuide'
import styles from './HomeRail.module.css'

type PostOrder = 'popular' | 'latest'

/**
 * 홈 오른쪽 열(2026-10-30 재정비). 위는 처음 쓰는 순서(사용설명서), 아래는 커뮤니티 예시 글이다.
 * 16:9에서 홈 오른쪽이 비어 보인다는 말에 사용자가 정한 자리다. 둘 다 서버를 부르지 않는다 —
 * 글은 src/content의 두 파일에만 있다(사용자가 고치기 쉽게).
 */
export default function HomeRail() {
  return (
    <aside className={styles.rail} aria-label="처음 쓰는 순서와 커뮤니티">
      <GuideSteps />
      <CommunityPreview />
    </aside>
  )
}

function GuideSteps() {
  return (
    <section aria-labelledby="home-guide-title">
      <div className={styles.head}>
        <h2 id="home-guide-title" className={styles.title}>
          사용설명서
        </h2>
        <Link to="/guide" className={styles.more}>
          전체 보기
        </Link>
      </div>
      <p className={styles.intro}>{HOME_GUIDE_INTRO}</p>
      <ol className={styles.steps}>
        {HOME_GUIDE_STEPS.map((step, index) => {
          const body = (
            <>
              <span className={styles.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              <span className={styles.stepText}>
                <strong>{step.title}</strong>
                <small>{step.description}</small>
              </span>
            </>
          )
          return (
            <li key={step.title}>
              {step.to === undefined ? (
                <div className={styles.step}>{body}</div>
              ) : (
                <Link to={step.to} className={`${styles.step} ${styles.stepLink}`}>
                  {body}
                  <span className={styles.chevron} aria-hidden="true">
                    ›
                  </span>
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** 커뮤니티 백엔드가 없어 예시 글을 보인다(src/content/communityPreview.ts). 글을 눌러 갈 곳이 없어 링크로 만들지 않는다 */
function CommunityPreview() {
  const [order, setOrder] = useState<PostOrder>('popular')
  const posts = useMemo(
    () =>
      [...COMMUNITY_PREVIEW_POSTS].sort((a, b) =>
        order === 'popular' ? b.likes - a.likes : a.minutesAgo - b.minutesAgo,
      ),
    [order],
  )

  return (
    <section aria-labelledby="home-community-title">
      <div className={styles.head}>
        <h2 id="home-community-title" className={styles.title}>
          커뮤니티
        </h2>
        <span className={styles.sampleTag}>예시</span>
        <div className={styles.tabs} role="group" aria-label="글 정렬">
          <button
            type="button"
            className={styles.tab}
            aria-pressed={order === 'popular'}
            onClick={() => setOrder('popular')}
          >
            인기
          </button>
          <button
            type="button"
            className={styles.tab}
            aria-pressed={order === 'latest'}
            onClick={() => setOrder('latest')}
          >
            최신
          </button>
        </div>
      </div>
      <ul className={styles.posts}>
        {posts.map((post) => (
          <li key={post.id} className={styles.post}>
            <p className={styles.postTitle}>
              <span className={styles.postTag}>{post.tag}</span>
              <span className={styles.postText}>{post.title}</span>
            </p>
            <p className={styles.postMeta}>
              <span className={styles.sampleTag}>예시 글</span>
              <span>{post.author}</span>
              <span>{timeAgo(post.minutesAgo)}</span>
              <span>댓글 {post.comments}</span>
              <span>좋아요 {post.likes}</span>
            </p>
          </li>
        ))}
      </ul>
      <p className={styles.notice}>커뮤니티는 준비 중이에요. 지금 보이는 글은 예시예요.</p>
    </section>
  )
}

function timeAgo(minutes: number): string {
  if (minutes < 60) return `${minutes}분 전`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`
  return `${Math.floor(minutes / (60 * 24))}일 전`
}
