import { useEffect, useId, useRef } from 'react'
import { IconTrash, IconX } from './Icons'

interface ConfirmDeleteDialogProps {
  taskTitle: string
  onClose: () => void
  onConfirm: () => void
}

export function ConfirmDeleteDialog({
  taskTitle,
  onClose,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
    }

    document.body.classList.add('modal-open')

    return () => {
      document.body.classList.remove('modal-open')
      if (dialog?.open) {
        dialog.close()
      }
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog modal-dialog--compact"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="confirm-card">
        <button
          type="button"
          className="icon-action confirm-card__close"
          aria-label="Cerrar"
          onClick={onClose}
        >
          <IconX />
        </button>

        <span className="confirm-card__icon" aria-hidden="true">
          <IconTrash />
        </span>
        <p className="modal-card__eyebrow">Acción irreversible</p>
        <h2 id={titleId}>Eliminar tarea</h2>
        <p id={descriptionId} className="confirm-card__description">
          ¿Seguro que quieres eliminar <strong>«{taskTitle}»</strong>? Esta
          acción no se puede deshacer.
        </p>

        <div className="confirm-card__actions">
          <button
            type="button"
            className="button button--ghost"
            autoFocus
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={onConfirm}
          >
            Eliminar tarea
          </button>
        </div>
      </div>
    </dialog>
  )
}
