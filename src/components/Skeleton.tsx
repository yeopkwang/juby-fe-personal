import styles from './Skeleton.module.css'

interface Props {
  /**
   * 자리의 크기·여백·모서리. 화면마다 달라서 부르는 쪽이 정한다.
   * 이 컴포넌트는 '어떻게 보이는가'만 맡는다.
   */
  className?: string
  /**
   * 화면을 읽어 주는 도구에 들려줄 문구.
   *
   * 판을 여러 장 늘어놓을 때는 낱장마다 붙이지 않는다. "불러오는 중"을 네 번 읽어
   * 봐야 알게 되는 것이 없다. 그때는 묶는 쪽에 한 번만 붙이고 낱장은 비워 둔다.
   */
  label?: string
}

/**
 * 내용이 오기 전 자리를 잡아 두는 회색 판.
 *
 * 다섯 화면이 같은 그라디언트와 @keyframes를 각자 복사해 두고 있었다.
 * CSS Modules는 @keyframes 이름도 파일마다 따로 만들기 때문에, 스타일시트 한 곳으로
 * 옮기는 것만으로는 합쳐지지 않는다(모듈 안의 `animation: shimmer`가 그 파일 전용
 * 이름을 찾는다). 그래서 컴포넌트로 묶었다.
 */
export default function Skeleton({ className, label }: Props) {
  return (
    <div
      className={
        className === undefined
          ? styles.skeleton
          : `${styles.skeleton} ${className}`
      }
      aria-label={label}
      /* 문구가 없는 판은 장식이다. 읽어 줄 내용이 없으므로 아예 건너뛰게 한다 */
      aria-hidden={label === undefined ? true : undefined}
    />
  )
}
