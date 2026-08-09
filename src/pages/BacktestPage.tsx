import ComingSoon from '../components/ComingSoon'

/**
 * 화면만 준비중이다. 백엔드 `GET /api/backtest/run`은 이미 동작한다
 * (종목코드·성향번호·기간을 주면 안정성·수익성·효율성·성장성 지표와 총점을 돌려준다).
 * 결과를 어떻게 보여줄지 디자인이 정해지면 이 파일을 실제 화면으로 바꾼다.
 */
export default function BacktestPage() {
  return (
    <ComingSoon
      title="주식 백테스트 준비중입니다"
      description="과거 데이터로 내 투자성향에 맞는 종목인지 점수를 매기는 기능이에요. 화면을 만들고 있어요."
    />
  )
}
