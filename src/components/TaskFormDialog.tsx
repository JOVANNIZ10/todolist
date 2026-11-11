import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { addDays } from '../domain/dates'
import { formatCompactDate } from '../lib/formatters'
import { nextRecurrenceDate } from '../domain/recurrence'
import {
  createSubtask,
  hasTaskValidationErrors,
  MAX_SUBTASK_LENGTH,
  MAX_SUBTASKS,
  MAX_TITLE_LENGTH,
  validateTaskDraft,
  type TaskValidationErrors,
} from '../domain/tasks'
import {
  RECURRENCE_FREQUENCY_OPTIONS,
  REMINDER_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  formatReminder,
} from '../lib/labels'
import type {
  RecurrenceFrequency,
  RecurrenceRule,
  Subtask,
  Task,
  TaskDraft,
  TaskPriority,
  TaskStatus,
} from '../types'
import {
  IconBell,
  IconCalendar,
  IconCheckList,
  IconPlus,
  IconRepeat,
  IconTrash,
  IconX,
} from './Icons'

interface TaskFormDialogProps {
  initialTask: Task | null
  defaultAssignedDate: string | null
  today: string
  projects: string[]
  onClose: () => void
  onSave: (draft: TaskDraft) => void
}

interface FormErrors extends TaskValidationErrors {
  general?: string
}

const RECURRENCE_UNITS: Record<
  Exclude<RecurrenceFrequency, 'weekdays'>,
  string
> = {
  daily: 'días',
  weekly: 'semanas',
  monthly: 'meses',
}

export function TaskFormDialog({
  initialTask,
  defaultAssignedDate,
  today,
  projects,
  onClose,
  onSave,
}: TaskFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const newSubtaskRef = useRef<HTMLInputElement>(null)
  const dialogTitleId = useId()
  const titleErrorId = useId()
  const titleCounterId = useId()
  const projectListId = useId()
  const isEditing = initialTask !== null

  const [title, setTitle] = useState(initialTask?.title ?? '')
  const [description, setDescription] = useState(
    initialTask?.description ?? '',
  )
  const [assignedDate, setAssignedDate] = useState(
    initialTask
      ? (initialTask.assignedDate ?? '')
      : (defaultAssignedDate ?? ''),
  )
  const [time, setTime] = useState(initialTask?.time ?? '')
  const [project, setProject] = useState(initialTask?.project ?? '')
  const [status, setStatus] = useState<TaskStatus>(
    initialTask?.status ?? 'pending',
  )
  const [priority, setPriority] = useState<TaskPriority>(
    initialTask?.priority ?? 'medium',
  )
  const [subtasks, setSubtasks] = useState<Subtask[]>(() =>
    (initialTask?.subtasks ?? []).map((subtask) => ({ ...subtask })),
  )
  const [newSubtask, setNewSubtask] = useState('')
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<
    RecurrenceFrequency | 'none' | 'fixed-daily'
  >(
    initialTask?.fixedDaily
      ? 'fixed-daily'
      : (initialTask?.recurrence?.frequency ?? 'none'),
  )
  const [recurrenceInterval, setRecurrenceInterval] = useState(
    initialTask?.recurrence?.interval ?? 1,
  )
  const [reminderMinutes, setReminderMinutes] = useState(
    initialTask?.reminderMinutes?.toString() ?? '',
  )
  const [errors, setErrors] = useState<FormErrors>({})

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
    }

    document.body.classList.add('modal-open')
    const focusFrame = window.requestAnimationFrame(() => {
      titleInputRef.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.classList.remove('modal-open')
      if (dialog?.open) {
        dialog.close()
      }
    }
  }, [])

  const tomorrow = addDays(today, 1)
  const fixedDaily = recurrenceFrequency === 'fixed-daily'

  const recurrence: RecurrenceRule | null =
    recurrenceFrequency === 'none'
      ? null
      : fixedDaily
        ? { frequency: 'daily', interval: 1 }
        : {
            frequency: recurrenceFrequency,
            interval:
              recurrenceFrequency === 'weekdays'
                ? 1
                : Math.min(99, Math.max(1, recurrenceInterval || 1)),
          }

  let nextDate: string | null = null
  if (recurrence) {
    try {
      nextDate = nextRecurrenceDate(
        assignedDate || today,
        recurrence,
        today,
      )
    } catch {
      nextDate = null
    }
  }

  const handleAddSubtask = () => {
    const subtaskTitle = newSubtask.trim()
    if (!subtaskTitle || subtasks.length >= MAX_SUBTASKS) return

    setSubtasks((current) => [
      ...current,
      createSubtask(subtaskTitle.slice(0, MAX_SUBTASK_LENGTH)),
    ])
    setNewSubtask('')
    newSubtaskRef.current?.focus()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const draft: TaskDraft = {
      title,
      description,
      status,
      priority,
      assignedDate: assignedDate || (fixedDaily ? today : null),
      time: time || null,
      project: project || null,
      subtasks,
      recurrence,
      fixedDaily,
      reminderMinutes:
        reminderMinutes === '' ? null : Number(reminderMinutes),
    }
    const nextErrors = validateTaskDraft(draft)

    if (hasTaskValidationErrors(nextErrors)) {
      setErrors(nextErrors)
      return
    }

    try {
      onSave(draft)
    } catch (error) {
      setErrors({
        general:
          error instanceof Error
            ? error.message
            : 'No se ha podido guardar la tarea.',
      })
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog"
      aria-labelledby={dialogTitleId}
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
      <div className="modal-card">
        <header className="modal-card__header">
          <div>
            <p className="modal-card__eyebrow">
              {isEditing ? 'Editar tarea' : 'Nueva tarea'}
            </p>
            <h2 id={dialogTitleId}>
              {isEditing ? 'Pon al día los detalles' : '¿Qué quieres hacer?'}
            </h2>
          </div>
          <button
            type="button"
            className="icon-action icon-action--large"
            aria-label="Cerrar formulario"
            onClick={onClose}
          >
            <IconX />
          </button>
        </header>

        <form className="task-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <div className="form-label-row">
              <label htmlFor="task-title">Título</label>
              <span
                id={titleCounterId}
                className={`char-counter${
                  title.length >= MAX_TITLE_LENGTH
                    ? ' char-counter--limit'
                    : ''
                }`}
              >
                {title.length}/{MAX_TITLE_LENGTH}
              </span>
            </div>
            <input
              ref={titleInputRef}
              id="task-title"
              type="text"
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              autoComplete="off"
              placeholder="Ej. Llamar al dentista"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={`${titleCounterId}${
                errors.title ? ` ${titleErrorId}` : ''
              }`}
              onChange={(event) => {
                setTitle(event.target.value)
                if (errors.title) {
                  setErrors((current) => ({
                    ...current,
                    title: undefined,
                  }))
                }
              }}
            />
            {errors.title && (
              <p id={titleErrorId} className="field-error">
                {errors.title}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="task-description">Descripción</label>
            <textarea
              id="task-description"
              value={description}
              rows={3}
              placeholder="Añade contexto, pasos o notas (opcional)"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <fieldset className="form-field subtasks-field">
            <legend>
              <IconCheckList className="field-legend-icon" />
              Subtareas
            </legend>

            {subtasks.length > 0 && (
              <ul className="subtask-editor">
                {subtasks.map((subtask) => (
                  <li key={subtask.id} className="subtask-editor__item">
                    <input
                      type="checkbox"
                      checked={subtask.done}
                      aria-label={`Hecha: ${subtask.title || 'subtarea'}`}
                      onChange={() =>
                        setSubtasks((current) =>
                          current.map((item) =>
                            item.id === subtask.id
                              ? { ...item, done: !item.done }
                              : item,
                          ),
                        )
                      }
                    />
                    <input
                      type="text"
                      value={subtask.title}
                      maxLength={MAX_SUBTASK_LENGTH}
                      aria-label="Título de la subtarea"
                      onChange={(event) =>
                        setSubtasks((current) =>
                          current.map((item) =>
                            item.id === subtask.id
                              ? { ...item, title: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="icon-action icon-action--danger"
                      aria-label="Quitar subtarea"
                      onClick={() =>
                        setSubtasks((current) =>
                          current.filter(
                            (item) => item.id !== subtask.id,
                          ),
                        )
                      }
                    >
                      <IconTrash />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="subtask-add">
              <input
                ref={newSubtaskRef}
                type="text"
                value={newSubtask}
                maxLength={MAX_SUBTASK_LENGTH}
                placeholder="Añade un paso (opcional)"
                aria-label="Nueva subtarea"
                onChange={(event) => setNewSubtask(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleAddSubtask()
                  }
                }}
              />
              <button
                type="button"
                className="button button--ghost button--compact"
                disabled={
                  newSubtask.trim() === '' ||
                  subtasks.length >= MAX_SUBTASKS
                }
                onClick={handleAddSubtask}
              >
                <IconPlus />
                Añadir
              </button>
            </div>
            <div className="field-hint">
              Marca los pasos que ya hayas completado. Se guardan dentro de la
              tarea.
            </div>
          </fieldset>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="task-date">Fecha</label>
              <div className="date-input-wrap">
                <IconCalendar />
                <input
                  id="task-date"
                  type="date"
                  value={assignedDate}
                  aria-invalid={Boolean(errors.assignedDate)}
                  onChange={(event) => {
                    setAssignedDate(event.target.value)
                    if (errors.assignedDate) {
                      setErrors((current) => ({
                        ...current,
                        assignedDate: undefined,
                      }))
                    }
                  }}
                />
              </div>
              {errors.assignedDate && (
                <p className="field-error">{errors.assignedDate}</p>
              )}
              <div className="quick-dates" aria-label="Fechas rápidas">
                <button
                  type="button"
                  className={assignedDate === today ? 'is-active' : ''}
                  onClick={() => setAssignedDate(today)}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  className={assignedDate === tomorrow ? 'is-active' : ''}
                  onClick={() => setAssignedDate(tomorrow)}
                >
                  Mañana
                </button>
                <button
                  type="button"
                  className={assignedDate === '' ? 'is-active' : ''}
                  disabled={fixedDaily}
                  title={
                    fixedDaily
                      ? 'Una tarea fija necesita una fecha para empezar'
                      : undefined
                  }
                  onClick={() => setAssignedDate('')}
                >
                  Sin fecha
                </button>
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="task-time">Hora</label>
              <input
                id="task-time"
                type="time"
                value={time}
                aria-invalid={Boolean(errors.time)}
                onChange={(event) => {
                  const nextTime = event.target.value
                  setTime(nextTime)
                  if (!nextTime) setReminderMinutes('')
                  if (errors.time) {
                    setErrors((current) => ({
                      ...current,
                      time: undefined,
                    }))
                  }
                }}
              />
              {errors.time && <p className="field-error">{errors.time}</p>}
              <div className="field-hint">
                La hora define el orden del día. Es opcional.
              </div>
            </div>
          </div>

          <div className="form-grid">
            <fieldset className="form-field recurrence-field">
              <legend>
                <IconRepeat className="field-legend-icon" />
                Repetición
              </legend>
              <select
                value={recurrenceFrequency}
                aria-label="Frecuencia de repetición"
                onChange={(event) => {
                  const value = event.target.value as
                    | RecurrenceFrequency
                    | 'none'
                    | 'fixed-daily'
                  setRecurrenceFrequency(value)
                  if (value === 'weekdays' || value === 'fixed-daily') {
                    setRecurrenceInterval(1)
                  }
                  if (value === 'fixed-daily' && assignedDate === '') {
                    setAssignedDate(today)
                  }
                }}
              >
                <option value="none">No se repite</option>
                <option value="fixed-daily">Fijar todos los días</option>
                {RECURRENCE_FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {recurrenceFrequency !== 'none' &&
                recurrenceFrequency !== 'weekdays' &&
                recurrenceFrequency !== 'fixed-daily' && (
                  <div className="interval-field">
                    <span>Repetir cada</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={recurrenceInterval}
                      aria-label="Intervalo de repetición"
                      onChange={(event) =>
                        setRecurrenceInterval(
                          Math.min(
                            99,
                            Math.max(1, Number(event.target.value) || 1),
                          ),
                        )
                      }
                    />
                    <span>
                      {RECURRENCE_UNITS[
                        recurrenceFrequency as keyof typeof RECURRENCE_UNITS
                      ]}
                    </span>
                  </div>
                )}

              {fixedDaily ? (
                <div className="recurrence-next">
                  Aparecerá cada día hasta que la completes. Al completarla,
                  volverá al día siguiente.
                </div>
              ) : nextDate ? (
                <div className="recurrence-next">
                  Próxima aparición: <strong>{formatCompactDate(nextDate)}</strong>
                </div>
              ) : (
                <div className="field-hint">
                  Al completarla se creará automáticamente la siguiente.
                </div>
              )}
            </fieldset>

            <div className="form-field">
              <label htmlFor="task-reminder">
                <IconBell className="field-label-icon" />
                Recordatorio
              </label>
              <select
                id="task-reminder"
                value={reminderMinutes}
                disabled={!time}
                aria-invalid={Boolean(errors.reminder)}
                onChange={(event) => {
                  setReminderMinutes(event.target.value)
                  if (errors.reminder) {
                    setErrors((current) => ({
                      ...current,
                      reminder: undefined,
                    }))
                  }
                }}
              >
                {REMINDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.reminder && (
                <p className="field-error">{errors.reminder}</p>
              )}
              <div className="field-hint">
                {time
                  ? reminderMinutes === ''
                    ? 'No se enviará ningún aviso.'
                    : Number(reminderMinutes) === 0
                      ? 'Aviso a la hora elegida.'
                      : `Aviso ${formatReminder(
                          Number(reminderMinutes),
                        )?.toLocaleLowerCase('es')} de la hora elegida.`
                  : 'Añade una hora para activar el recordatorio.'}
              </div>
            </div>
          </div>

          <div className="form-grid">
            <fieldset className="form-field priority-field">
              <legend>Prioridad</legend>
              <div className="segmented-control">
                {TASK_PRIORITY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`segment segment--${option.value}${
                      priority === option.value ? ' is-active' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="priority"
                      value={option.value}
                      checked={priority === option.value}
                      onChange={() => setPriority(option.value)}
                    />
                    <span className="segment__dot" aria-hidden="true" />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="form-field">
              <label htmlFor="task-status">Estado</label>
              <select
                id="task-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as TaskStatus)
                }
              >
                {TASK_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="task-project">Proyecto o etiqueta</label>
            <input
              id="task-project"
              type="text"
              list={projectListId}
              value={project}
              autoComplete="off"
              placeholder="Ej. Casa, trabajo, recados…"
              onChange={(event) => setProject(event.target.value)}
            />
            <datalist id={projectListId}>
              {projects.map((projectName) => (
                <option key={projectName} value={projectName} />
              ))}
            </datalist>
            <div className="field-hint">
              Sirve para agrupar y filtrar tus tareas.
            </div>
          </div>

          {errors.general && (
            <p className="form-error" role="alert">
              {errors.general}
            </p>
          )}

          <footer className="modal-card__footer">
            <button
              type="button"
              className="button button--ghost"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className="button button--primary">
              {isEditing ? 'Guardar cambios' : 'Crear tarea'}
            </button>
          </footer>
        </form>
      </div>
    </dialog>
  )
}
