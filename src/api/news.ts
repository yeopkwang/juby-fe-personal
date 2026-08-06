import { get } from './client'
import type { NewsItem, NewsSearchResponse } from '../types/market'

/**
 * 네이버가 검색어를 <b> 태그로 감싸고 따옴표 같은 문자를 엔티티로 바꿔서 내려준다.
 * 태그를 먼저 지운 뒤 textarea에 넣어 엔티티를 되돌린다.
 * textarea의 내용은 HTML로 해석되지 않으므로 태그가 남아 있어도 실행되지 않는다.
 */
function stripHtml(text: string): string {
  const element = document.createElement('textarea')
  element.innerHTML = text.replace(/<[^>]+>/g, '')
  return element.value
}

/** 언론사명이 응답에 없어 링크 도메인으로 대신한다 */
function toSource(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '')
  } catch {
    return '출처 미상'
  }
}

/** 종목 관련 뉴스. 네이버 검색 결과라 관련도 순으로 내려온다 */
export async function getNews(query: string): Promise<NewsItem[]> {
  const response = await get<NewsSearchResponse>(
    `/api/news?query=${encodeURIComponent(query)}`,
  )

  return response.items.map((item) => ({
    title: stripHtml(item.title),
    link: item.originallink,
    description: stripHtml(item.description),
    source: toSource(item.originallink),
    publishedAt: new Date(item.pubDate),
  }))
}
