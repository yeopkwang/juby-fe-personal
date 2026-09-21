import { useEffect } from 'react'

/** 탭 제목 뒤에 늘 붙는 서비스 이름 */
const SUFFIX = 'JUBY'

/**
 * 탭 제목을 화면 이름으로 바꾼다. 화면 이름만 주면 뒤에 서비스 이름을 붙인다.
 *
 * 떠날 때 되돌리지 않는다. 다음 화면이 자기 제목을 덮어쓰므로 되돌리면 그 사이에
 * 제목이 한 번 깜빡인다. 제목을 안 정한 화면은 앞 화면 제목을 잠시 물려받는다.
 *
 * 카카오톡·슬랙에 붙였을 때 뜨는 미리보기는 이걸로 안 바뀐다. 그쪽은 자바스크립트를
 * 실행하지 않고 index.html의 og 태그만 읽어서, 어느 주소를 붙이든 같은 미리보기가 뜬다.
 * 화면마다 다르게 하려면 서버에서 미리 그려 내보내야 한다.
 */
export function useDocumentTitle(name: string): void {
  useEffect(() => {
    document.title = name === '' ? SUFFIX : `${name} - ${SUFFIX}`
  }, [name])
}
