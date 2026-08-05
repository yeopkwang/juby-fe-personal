import { Link, useParams } from 'react-router-dom'

export default function StockChartPage() {
  const { stockCode } = useParams<{ stockCode: string }>()

  return (
    <div style={{ paddingTop: 40 }}>
      <h1>종목 상세</h1>
      <p>stockCode: {stockCode}</p>
      <Link to="/" style={{ textDecoration: 'underline' }}>
        홈으로
      </Link>
    </div>
  )
}
