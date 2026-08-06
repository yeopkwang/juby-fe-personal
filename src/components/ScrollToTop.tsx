import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * 라우터는 화면만 갈아끼우고 스크롤 위치는 그대로 둔다.
 * 그래서 목록 아래쪽에서 종목을 누르면 상세 화면이 뉴스 근처에서 시작한다.
 * 주소가 바뀔 때마다 맨 위로 올린다.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
