import type { ToastMessage } from '../hooks/useToast'
import { IconAlert, IconBell, IconCheck, IconX } from './Icons'

interface ToastProps {
  toast: ToastMessage
  onDismiss: () => void
}

export function Toast({ toast, onDismiss }: ToastProps) {
  return (
    <div
      className={`toast toast--${toast.tone}`}
      role={toast.tone === 'error' ? 'alert' : 'status'}
    >
      <span className="toast__icon" aria-hidden="true">
        {toast.tone === 'error' ? (
          <IconAlert />
        ) : toast.tone === 'reminder' ? (
          <IconBell />
        ) : (
          <IconCheck />
        )}
      </span>
      <p>{toast.message}</p>
      <button
        type="button"
        className="toast__close"
        aria-label="Cerrar aviso"
        onClick={onDismiss}
      >
        <IconX />
      </button>
    </div>
  )
}
