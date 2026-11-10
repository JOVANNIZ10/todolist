import type { DragEvent } from 'react'
import { daysBetween } from '../domain/dates'
import {
  isSubtaskProgress,
  isTaskOverdue,
} from '../domain/tasks'
import {
  formatOverdueAge,
  formatTaskDate,
  formatTime,
} from '../lib/formatters'
import {
  PRIORITY_LABELS,
  TASK_STATUS_OPTIONS,
  formatRecurrence,
  formatReminder,
} from '../lib/labels'
import type { Task, TaskStatus } from '../types'
import {
  IconAlert,
  IconArrowDown,
  IconArrowUp,
  IconBell,
  IconCalendar,
  IconCheck,
  IconCheckList,
  IconClock,
  IconFolder,
  IconGripVertical,
  IconPencil,
  IconRepeat,
  IconTrash,
} from './Icons'

export type DropPosition = 'before' | 'after'

interface TaskCardProps {
  task: Task
  today: string
  selectable: boolean
  selected: boolean
  reorderEnabled: boolean
  isDragging: boolean
  dropPosition: DropPosition | null
  canMoveUp: boolean
  canMoveDown: boolean
  onToggleSelected: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onStatusChange: (task: Task, status: TaskStatus) => void
  onToggleDone: (task: Task) => void
  onMoveToToday: (task: Task) => void
  onToggleSubtask: (taskId: string, subtaskId: string) => void
  onDragStart: (event: DragEvent<HTMLElement>, id: string) => void
  onDragOver: (event: DragEvent<HTMLElement>, id: string) => void
  onDrop: (event: DragEvent<HTMLElement>, id: string) => void
  onDragEnd: () => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export function TaskCard({
  task,
  today,
  selectable,
  selected,
  reorderEnabled,
  isDragging,
  dropPosition,
  canMoveUp,
  canMoveDown,
  onToggleSelected,
  onEdit,
  onDelete,
  onStatusChange,
  onToggleDone,
  onMoveToToday,
  onToggleSubtask,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
}: TaskCardProps) {
  const isDone = task.status === 'done'
  const isOverdue = isTaskOverdue(task, today)
  const completedTime = formatTime(task.completedAt)
  const overdueDays =
    task.assignedDate !== null
      ? Math.max(0, daysBetween(task.assignedDate, today))
      : 0
  const subtaskProgress = isSubtaskProgress(task)
  const recurrenceLabel = formatRecurrence(task.recurrence)
  const reminderLabel = formatReminder(task.reminderMinutes)

  const cardClasses = [
    'task-card',
    isDone ? 'task-card--done' : '',
    isOverdue ? 'task-card--overdue' : '',
    selected ? 'task-card--selected' : '',
    isDragging ? 'task-card--dragging' : '',
    dropPosition === 'before' ? 'task-card--drop-before' : '',
    dropPosition === 'after' ? 'task-card--drop-after' : '',
    reorderEnabled ? 'task-card--reorderable' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article
      className={cardClasses}
      aria-labelledby={`task-${task.id}`}
      draggable={reorderEnabled}
      onDragStart={(event) => onDragStart(event, task.id)}
      onDragOver={(event) => onDragOver(event, task.id)}
      onDrop={(event) => onDrop(event, task.id)}
      onDragEnd={onDragEnd}
    >
      <div className="task-card__rail">
        {reorderEnabled && (
          <span
            className="drag-grip"
            title="Arrastra para reordenar"
            aria-hidden="true"
          >
            <IconGripVertical />
          </span>
        )}
        <button
          type="button"
          className="completion-toggle"
          aria-label={
            isDone
              ? `Marcar «${task.title}» como pendiente`
              : `Marcar «${task.title}» como hecha`
          }
          aria-pressed={isDone}
          onClick={() => onToggleDone(task)}
        >
          <IconCheck className="completion-toggle__icon" />
        </button>
      </div>

      <div className="task-card__content">
        <div className="task-card__head">
          <div className="task-card__title-group">
            <h3 id={`task-${task.id}`}>{task.title}</h3>
            <div className="task-card__badges">
              {isOverdue && (
                <span
                  className="overdue-badge"
                  title={formatOverdueAge(
                    task.assignedDate as string,
                    overdueDays,
                  )}
                >
                  <IconAlert />
                  Atrasada
                </span>
              )}
              <span
                className={`priority-badge priority-badge--${task.priority}`}
                aria-label={`Prioridad ${PRIORITY_LABELS[task.priority]}`}
              >
                <span className="priority-badge__dot" aria-hidden="true" />
                {PRIORITY_LABELS[task.priority]}
              </span>
            </div>
          </div>

          <div className="task-card__actions">
            {reorderEnabled && (
              <div
                className="reorder-buttons"
                role="group"
                aria-label={`Reordenar «${task.title}»`}
              >
                <button
                  type="button"
                  className="icon-action icon-action--small"
                  aria-label={`Mover «${task.title}» hacia arriba`}
                  title="Mover arriba"
                  disabled={!canMoveUp}
                  onClick={() => onMoveUp(task.id)}
                >
                  <IconArrowUp />
                </button>
                <button
                  type="button"
                  className="icon-action icon-action--small"
                  aria-label={`Mover «${task.title}» hacia abajo`}
                  title="Mover abajo"
                  disabled={!canMoveDown}
                  onClick={() => onMoveDown(task.id)}
                >
                  <IconArrowDown />
                </button>
              </div>
            )}

            {selectable && (
              <label className="batch-select">
                <input
                  type="checkbox"
                  checked={selected}
                  aria-label={`Seleccionar «${task.title}»`}
                  onChange={() => onToggleSelected(task.id)}
                />
              </label>
            )}

            {isOverdue && (
              <button
                type="button"
                className="text-action text-action--move"
                onClick={() => onMoveToToday(task)}
              >
                <span>Mover a hoy</span>
              </button>
            )}

            <button
              type="button"
              className="icon-action"
              aria-label={`Editar «${task.title}»`}
              title="Editar tarea"
              onClick={() => onEdit(task)}
            >
              <IconPencil />
            </button>
            <button
              type="button"
              className="icon-action icon-action--danger"
              aria-label={`Eliminar «${task.title}»`}
              title="Eliminar tarea"
              onClick={() => onDelete(task)}
            >
              <IconTrash />
            </button>
          </div>
        </div>

        {task.description && (
          <p className="task-card__description" title={task.description}>
            {task.description}
          </p>
        )}

        {task.subtasks.length > 0 && (
          <ul
            className="subtask-list"
            aria-label={`Subtareas de «${task.title}»`}
          >
            {task.subtasks.map((subtask) => (
              <li
                key={subtask.id}
                className={`subtask-item${
                  subtask.done ? ' subtask-item--done' : ''
                }`}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={subtask.done}
                    disabled={isDone}
                    onChange={() =>
                      onToggleSubtask(task.id, subtask.id)
                    }
                  />
                  <span>{subtask.title}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="task-meta">
          <label
            className={`status-select status-select--${task.status}`}
          >
            <span className="status-select__dot" aria-hidden="true" />
            <span className="sr-only">Estado de {task.title}</span>
            <select
              value={task.status}
              onChange={(event) =>
                onStatusChange(task, event.target.value as TaskStatus)
              }
              aria-label={`Estado de «${task.title}»`}
            >
              {TASK_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <span
            className={`meta-item${
              isOverdue ? ' meta-item--overdue' : ''
            }`}
          >
            {isOverdue ? <IconAlert /> : <IconCalendar />}
            {task.assignedDate ? (
              <time dateTime={task.assignedDate}>
                {isOverdue
                  ? formatOverdueAge(task.assignedDate, overdueDays)
                  : formatTaskDate(task.assignedDate, today)}
              </time>
            ) : (
              <span>Sin fecha</span>
            )}
          </span>

          {task.time && (
            <span className="meta-item">
              <IconClock />
              <time dateTime={task.time}>{task.time}</time>
            </span>
          )}

          {recurrenceLabel && (
            <span
              className="meta-item meta-item--recurrence"
              title={`Se repite: ${recurrenceLabel.toLocaleLowerCase('es')}`}
            >
              <IconRepeat />
              {recurrenceLabel}
            </span>
          )}

          {reminderLabel && (
            <span
              className="meta-item meta-item--reminder"
              title={`Recordatorio: ${reminderLabel.toLocaleLowerCase('es')}`}
            >
              <IconBell />
              {reminderLabel}
            </span>
          )}

          {task.project && (
            <span className="meta-item meta-item--project">
              <IconFolder />
              {task.project}
            </span>
          )}

          {subtaskProgress.total > 0 && (
            <span className="meta-item meta-item--subtasks">
              <IconCheckList />
              {subtaskProgress.done}/{subtaskProgress.total}{' '}
              {subtaskProgress.total === 1 ? 'subtarea' : 'subtareas'}
            </span>
          )}

          {isDone && completedTime && (
            <span className="meta-item meta-item--completed">
              <IconCheck />
              Hecha a las {completedTime}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
