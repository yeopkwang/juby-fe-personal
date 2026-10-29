import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { isStockCode } from '../api/stock'
import type { StockInfo } from '../types/stock'

/**
 * 종목 상세의 바로 가기('이 종목 백테스트'·'AI에게 물어보기')가 navigate state에 싣는 종목.
 * 받는 화면이 그 종목으로 곧바로 실행한다(백테스트 계산, AI 질문). 주소에 달지 않는 건 새로고침·공유한 주소로
 * 다시 실행되면 안 돼서다 — state도 주소 기록에 남으므로 받는 쪽이 한 번 읽고 비운다(useStockHandoff).
 */
export function toStockHandoff(stock: StockInfo): { handoff: StockInfo } {
  return { handoff: stock }
}

function hasHandoff(state: unknown): state is { handoff: unknown } {
  return typeof state === 'object' && state !== null && 'handoff' in state
}

/** 모양이 틀리면(종목코드가 여섯 자리 숫자가 아니거나 이름이 빈 문자열) 없는 셈 친다 */
function readHandoff(state: unknown): StockInfo | null {
  if (!hasHandoff(state)) return null
  const handoff = state.handoff
  if (typeof handoff !== 'object' || handoff === null) return null
  const { stockCode, stockName } = handoff as Record<string, unknown>
  if (typeof stockCode !== 'string' || !isStockCode(stockCode)) return null
  if (typeof stockName !== 'string' || stockName.trim() === '') return null
  return { stockCode, stockName }
}

/**
 * 종목 상세에서 실어 온 종목. 없거나 모양이 틀리면 null.
 *
 * 처음 그릴 때 한 번만 읽고, 곧바로 같은 주소로 바꿔 넣으며(replace) state를 비운다. 그대로 두면 새로고침·뒤로 갔다
 * 앞으로 오기에 같은 state가 살아 있어 백테스트가 다시 계산되고 AI 방이 또 생긴다. 읽은 값은 이 화면이 떠 있는 동안 그대로다 —
 * 언제 실행할지(성향·대화방 목록을 기다린 뒤 한 번)는 부르는 화면이 정한다.
 */
export function useStockHandoff(): StockInfo | null {
  const location = useLocation()
  const navigate = useNavigate()
  const [handoff] = useState(() => readHandoff(location.state))

  useEffect(() => {
    if (!hasHandoff(location.state)) return
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [location.pathname, location.search, location.state, navigate])

  return handoff
}
