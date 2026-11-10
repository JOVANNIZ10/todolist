import { useCallback, useEffect, useRef } from 'react'
import {
  getReminderDueAt,
  isReminderDue,
} from '../domain/tasks'
import type { Task } from '../types'

const CHECK_INTERVAL_MS = 30_000

/**
 * Detecta recordatorios vencidos mientras la app está abierta y avisa una sola
 * vez por tarea y horario. El aviso real lo decide App (toast + notificación
 * del navegador si el usuario lo ha activado).
 */
export function useReminders(
  tasks: readonly Task[],
  onDue: (dueTasks: Task[], now: Date) => void,
): void {
  const firedRef = useRef(new Set<string>())

  const checkReminders = useCallback(() => {
    const now = new Date()
    const dueTasks = tasks.filter((task) => {
      if (!isReminderDue(task, now)) return false

      const dueAt = getReminderDueAt(task)
      const key = `${task.id}:${dueAt?.toISOString() ?? ''}`
      if (firedRef.current.has(key)) return false

      firedRef.current.add(key)
      return true
    })

    if (dueTasks.length > 0) {
      onDue(dueTasks, now)
    }
  }, [tasks, onDue])

  useEffect(() => {
    checkReminders()

    const intervalId = window.setInterval(
      checkReminders,
      CHECK_INTERVAL_MS,
    )
    const handleFocus = () => checkReminders()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkReminders()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [checkReminders])
}
