import { useEffect, useState } from 'react'
import type { FocusEvent, FormEvent, KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { prefetchCandles } from '../api/candles'
import { searchStocks } from '../api/stock'
import type { StockInfo } from '../types/stock'
import styles from './SearchBar.module.css'

export default function SearchBar() {
  const [keyword, setKeyword] = useState('')
  const [suggestions, setSuggestions] = useState<StockInfo[]>([])
  /** 화살표로 고른 후보. -1이면 아직 아무것도 안 골랐다 */
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const trimmed = keyword.trim()
    if (trimmed === '') {
      setSuggestions([])
      setActiveIndex(-1)
      return
    }

    // 지금은 로컬 목록이라 바로 끝나지만, 검색 API로 바뀌면 늦게 온 응답이 최신 입력을 덮을 수 있다
    let isStale = false

    searchStocks(trimmed).then((found) => {
      if (isStale) return
      setSuggestions(found)
      setActiveIndex(-1)
    })

    return () => {
      isStale = true
    }
  }, [keyword])

  /*
   * Enter는 화살표로 고른 후보로, 안 골랐으면 첫 후보로 간다(handleSubmit과 같은 규칙).
   * 마우스가 목록 위를 지나지 않는 길이라 hover만으로는 미리 받을 기회가 없다.
   *
   * 글자를 칠 때마다 첫 후보가 바뀌므로 잠깐 멈춘 뒤에야 받아온다.
   * 안 그러면 "삼성전자"를 치는 동안 후보가 바뀔 때마다 요청이 나간다.
   */
  useEffect(() => {
    const target = suggestions[activeIndex >= 0 ? activeIndex : 0]
    if (target === undefined) return

    const timer = setTimeout(() => prefetchCandles(target.stockCode), 250)
    return () => clearTimeout(timer)
  }, [suggestions, activeIndex])

  function goTo(stock: StockInfo) {
    setIsOpen(false)
    setMessage('')
    navigate(`/stocks/${stock.stockCode}`)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (keyword.trim() === '') return

    // 화살표로 고른 게 있으면 그것, 없으면 가장 잘 맞는 첫 후보로 간다
    const target = suggestions[activeIndex >= 0 ? activeIndex : 0]
    if (target === undefined) {
      setMessage('해당 종목을 찾을 수 없습니다')
      return
    }

    goTo(target)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setIsOpen(false)
      return
    }

    if (suggestions.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((index) => (index + 1) % suggestions.length)
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      )
    }
  }

  function handleBlur(event: FocusEvent<HTMLFormElement>) {
    // 후보 버튼으로 포커스가 옮겨간 것뿐이면 닫지 않는다
    if (event.currentTarget.contains(event.relatedTarget)) return
    setIsOpen(false)
  }

  const isListVisible = isOpen && suggestions.length > 0

  return (
    <form className={styles.form} onSubmit={handleSubmit} onBlur={handleBlur}>
      <div className={styles.box}>
        <input
          className={styles.input}
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value)
            setIsOpen(true)
            setMessage('')
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="관심종목을 입력해주세요 (예 : 삼성전자)"
          /* 종목명은 사전에 없어서 빨간 물결선이 그어진다 (백테스트 종목칸과 같은 이유) */
          spellCheck={false}
          role="combobox"
          aria-expanded={isListVisible}
          aria-controls="stock-suggestions"
          aria-autocomplete="list"
        />
        <button type="submit" className={styles.button}>
          검색
        </button>
      </div>

      {isListVisible && (
        <ul className={styles.list} id="stock-suggestions" role="listbox">
          {suggestions.map((stock, index) => (
            <li key={stock.stockCode} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={
                  index === activeIndex
                    ? `${styles.option} ${styles.optionActive}`
                    : styles.option
                }
                // 눌리기 전에 input이 포커스를 잃으면 목록이 먼저 닫혀 클릭이 사라진다
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => prefetchCandles(stock.stockCode)}
                onClick={() => goTo(stock)}
              >
                <span className={styles.optionName}>{stock.stockName}</span>
                <span className={styles.optionCode}>{stock.stockCode}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {message !== '' && <p className={styles.message}>{message}</p>}
    </form>
  )
}
