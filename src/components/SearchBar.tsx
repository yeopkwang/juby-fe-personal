import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchStock } from '../api/stock'
import styles from './SearchBar.module.css'

export default function SearchBar() {
  const [keyword, setKeyword] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = keyword.trim()
    if (trimmed === '') return

    const stock = await searchStock(trimmed)
    if (stock === null) {
      setMessage('해당 종목을 찾을 수 없습니다')
      return
    }

    setMessage('')
    navigate(`/stocks/${stock.stockCode}`)
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.box}>
        <input
          className={styles.input}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="관심종목을 입력해주세요 (예 : 삼성전자)"
        />
        <button type="submit" className={styles.button}>
          검색
        </button>
      </div>
      {message !== '' && <p className={styles.message}>{message}</p>}
    </form>
  )
}
