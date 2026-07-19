import { useEffect, useSyncExternalStore } from 'react'
import type { TimerState } from '../types/timer'
import { useAppStore } from '../store/useAppStore'

// 1초 간격으로 리렌더를 유발하는 외부 시계 구독 (초 단위 스냅샷이라 같은 초에는 안정적)
const subscribeEverySecond = (onTick: () => void) => {
  const id = setInterval(onTick, 1000)
  return () => clearInterval(id)
}

const getNowSeconds = () => Math.floor(Date.now() / 1000)

// 진행 중일 때 endsAt 기준 남은 시간을 계산하고, 0 도달 시 다음 단계로 전환.
// advancePhase 중복 호출을 막기 위해 화면당 한 번만 사용해야 함 (카드에는 결과를 내려줌)
export const useTimer = (): TimerState => {
  const timerState = useAppStore(s => s.timerState)
  const advancePhase = useAppStore(s => s.advancePhase)
  const nowSeconds = useSyncExternalStore(subscribeEverySecond, getNowSeconds)

  const remaining =
    timerState.isRunning && timerState.endsAt !== null
      ? Math.max(0, Math.round(timerState.endsAt / 1000) - nowSeconds)
      : timerState.remaining

  useEffect(() => {
    if (timerState.isRunning && remaining <= 0) advancePhase()
  }, [timerState.isRunning, remaining, advancePhase])

  return { ...timerState, remaining }
}
