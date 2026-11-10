import { useCallback, useEffect, useRef, useState } from 'react'

export type ToastTone = 'success' | 'error' | 'reminder'

export interface ToastMessage {
  id: number
  message: string
  tone: ToastTone
}

const TOAST_DURATION_MS = 3600

export function useToast(): {
  toast: ToastMessage | null
  showToast: (message: string, tone?: ToastTone) => void
  dismissToast: () => void
} {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const timeoutRef = useRef<number | undefined>(undefined)
  const counterRef = useRef(0)

  const clearTimer = useCallback(() => {
    window.clearTimeout(timeoutRef.current)
  }, [])

  const dismissToast = useCallback(() => {
    clearTimer()
    setToast(null)
  }, [clearTimer])

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      clearTimer()
      counterRef.current += 1
      setToast({ id: counterRef.current, message, tone })

      timeoutRef.current = window.setTimeout(() => {
        setToast(null)
      }, TOAST_DURATION_MS)
    },
    [clearTimer],
  )

  useEffect(() => clearTimer, [clearTimer])

  return { toast, showToast, dismissToast }
}
