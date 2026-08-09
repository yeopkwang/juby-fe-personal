import ComingSoon from '../components/ComingSoon'

/** App.tsx의 path="*". 아직 만들지 않은 주소가 전부 여기로 온다 */
export default function NotReadyPage() {
  return (
    <ComingSoon
      title="기능 준비중입니다"
      description="아직 만들고 있는 화면이에요. 홈에서 다른 기능을 먼저 둘러보세요."
    />
  )
}
