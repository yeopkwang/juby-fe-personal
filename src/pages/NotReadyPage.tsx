import { Link, useLocation } from 'react-router-dom'

export default function NotReadyPage() {
  const { pathname } = useLocation()

  return (
    <div style={{ padding: '80px 0', textAlign: 'center' }}>
      <h2>아직 준비 중인 화면입니다</h2>
      <p style={{ color: 'var(--color-text-sub)' }}>{pathname}</p>
      <Link to="/" style={{ textDecoration: 'underline' }}>
        홈으로
      </Link>
    </div>
  )
}
