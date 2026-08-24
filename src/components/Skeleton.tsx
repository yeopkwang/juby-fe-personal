import styles from './Skeleton.module.css'

interface Props {
  /** 자리의 크기·여백·모서리. 화면마다 달라서 부르는 쪽이 정한다 */
  className?: string
  /**
   * 화면을 읽어 주는 도구에 들려줄 문구.
   * 판을 여러 장 늘어놓을 때는 묶는 쪽에 한 번만 붙이고 낱장은 비워 둔다.
   */
  label?: string
}

/**
 * 내용이 오기 전 자리를 잡아 두는 회색 판.
 *
 * 다섯 화면이 같은 그라디언트와 @keyframes를 각자 복사해 두고 있었다. CSS Modules는
 * @keyframes 이름도 파일마다 따로 만들어서 스타일시트만 옮겨서는 안 합쳐진다.
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
