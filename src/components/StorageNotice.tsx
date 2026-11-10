import { IconAlert, IconInfo, IconX } from './Icons'

interface StorageNoticeProps {
  message: string
  tone?: 'warning' | 'error'
  action?: {
    label: string
    onClick: () => void
  }
  onDismiss?: () => void
}

export function StorageNotice({
  message,
  tone = 'warning',
  action,
  onDismiss,
}: StorageNoticeProps) {
  return (
    <div
      className={`storage-notice storage-notice--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span className="storage-notice__icon" aria-hidden="true">
        {tone === 'error' ? <IconAlert /> : <IconInfo />}
      </span>
      <p>{message}</p>
      {action && (
        <button
          type="button"
          className="storage-notice__action"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          className="storage-notice__close"
          aria-label="Cerrar aviso"
          onClick={onDismiss}
        >
          <IconX />
        </button>
      )}
    </div>
  )
}
