import { useEffect, useState } from 'react'
import { msUntilNextMidnight, todayKey } from '../domain/dates'

/**
 * Mantiene actualizado el día local aunque la pestaña siga abierta a medianoche.
 * Además de un temporizador hasta las 00:00, se comprueba al recuperar el foco
 * o la visibilidad, escenario habitual tras suspender el equipo.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayKey)

  useEffect(() => {
    let timerId: number | undefined

    const updateToday = () => {
      setToday((current) => {
        const actual = todayKey()
        return current === actual ? current : actual
      })
    }

    const scheduleNextCheck = () => {
      window.clearTimeout(timerId)
      timerId = window.setTimeout(() => {
        updateToday()
        scheduleNextCheck()
      }, msUntilNextMidnight())
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateToday()
        scheduleNextCheck()
      }
    }

    const handleFocus = () => {
      updateToday()
      scheduleNextCheck()
    }

    scheduleNextCheck()
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearTimeout(timerId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return today
}
