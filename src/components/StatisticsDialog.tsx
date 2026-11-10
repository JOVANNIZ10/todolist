import { useEffect, useId, useRef } from 'react'
import { dateKeyToDate } from '../domain/dates'
import { pluralize } from '../lib/formatters'
import { PRIORITY_LABELS } from '../lib/labels'
import type { TaskStatistics } from '../domain/statistics'
import type { TaskPriority } from '../types'
import {
  IconAlert,
  IconChartBar,
  IconCheck,
  IconCheckList,
  IconClock,
  IconX,
} from './Icons'

interface StatisticsDialogProps {
  statistics: TaskStatistics
  onClose: () => void
}

const PRIORITY_ORDER: TaskPriority[] = ['high', 'medium', 'low']

function shortWeekday(dateKey: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
  })
    .format(dateKeyToDate(dateKey))
    .replace('.', '')
    .toLocaleUpperCase('es')
}

function dayNumber(dateKey: string): string {
  return String(dateKeyToDate(dateKey).getDate())
}

export function StatisticsDialog({
  statistics,
  onClose,
}: StatisticsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

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

  const maxDaily = Math.max(
    1,
    ...statistics.last7Days.map((day) => day.count),
  )

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog modal-dialog--wide"
      aria-labelledby={titleId}
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
      <div className="modal-card stats-card">
        <header className="modal-card__header">
          <div>
            <p className="modal-card__eyebrow">Tu progreso</p>
            <h2 id={titleId}>Estadísticas</h2>
          </div>
          <button
            type="button"
            className="icon-action icon-action--large"
            aria-label="Cerrar estadísticas"
            onClick={onClose}
          >
            <IconX />
          </button>
        </header>

        {statistics.total === 0 ? (
          <div className="stats-empty">
            <span className="stats-empty__icon" aria-hidden="true">
              <IconChartBar />
            </span>
            <h3>Aún no hay datos</h3>
            <p>
              Cuando crees y completes tareas, aquí verás tu progreso, tu
              actividad de los últimos días y el reparto por prioridad.
            </p>
          </div>
        ) : (
          <div className="stats-content">
            <div className="stats-summary">
              <div className="stat-card">
                <span className="stat-card__label">Total</span>
                <strong>{statistics.total}</strong>
                <span className="stat-card__hint">tareas registradas</span>
              </div>
              <div className="stat-card stat-card--done">
                <span className="stat-card__label">Hechas</span>
                <strong>{statistics.done}</strong>
                <span className="stat-card__hint">
                  {statistics.completionRate}% completado
                </span>
              </div>
              <div className="stat-card stat-card--pending">
                <span className="stat-card__label">Pendientes</span>
                <strong>{statistics.pending}</strong>
                <span className="stat-card__hint">
                  {statistics.dueToday} para hoy
                </span>
              </div>
              <div className="stat-card stat-card--overdue">
                <span className="stat-card__label">Atrasadas</span>
                <strong>{statistics.overdue}</strong>
                <span className="stat-card__hint">requieren atención</span>
              </div>
            </div>

            <section className="stats-panel" aria-label="Progreso general">
              <div className="stats-panel__heading">
                <div>
                  <p className="stats-panel__eyebrow">Progreso global</p>
                  <h3>
                    {statistics.done} de {statistics.total} tareas hechas
                  </h3>
                </div>
                <span className="stats-panel__figure">
                  {statistics.completionRate}%
                </span>
              </div>
              <div
                className="stats-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={statistics.total}
                aria-valuenow={statistics.done}
                aria-label="Porcentaje de tareas completadas"
              >
                <span
                  style={{ width: `${statistics.completionRate}%` }}
                />
              </div>
              <p className="stats-panel__detail">
                <IconClock />
                {pluralize(
                  statistics.completedThisWeek,
                  'tarea completada',
                  'tareas completadas',
                )}{' '}
                esta semana.
              </p>
            </section>

            <div className="stats-grid">
              <section className="stats-panel" aria-label="Actividad de los últimos siete días">
                <div className="stats-panel__heading">
                  <div>
                    <p className="stats-panel__eyebrow">Últimos 7 días</p>
                    <h3>Actividad reciente</h3>
                  </div>
                  <IconChartBar className="stats-panel__icon" />
                </div>
                <div
                  className="stats-chart"
                  role="img"
                  aria-label="Tareas completadas en los últimos siete días"
                >
                  {statistics.last7Days.map((day) => (
                    <div key={day.date} className="stats-chart__column">
                      <span
                        className="stats-chart__bar"
                        style={{
                          height: `${Math.max(
                            day.count > 0 ? 10 : 3,
                            (day.count / maxDaily) * 100,
                          )}%`,
                        }}
                        title={`${day.count} tarea${
                          day.count === 1 ? '' : 's'
                        } completada${day.count === 1 ? '' : 's'}`}
                      >
                        {day.count > 0 && (
                          <span className="stats-chart__value">
                            {day.count}
                          </span>
                        )}
                      </span>
                      <span className="stats-chart__weekday">
                        {shortWeekday(day.date)}
                      </span>
                      <span className="stats-chart__day">
                        {dayNumber(day.date)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="stats-panel" aria-label="Tareas por prioridad">
                <div className="stats-panel__heading">
                  <div>
                    <p className="stats-panel__eyebrow">Reparto</p>
                    <h3>Por prioridad</h3>
                  </div>
                  <IconCheckList className="stats-panel__icon" />
                </div>
                <div className="priority-stats">
                  {PRIORITY_ORDER.map((priority) => {
                    const item = statistics.byPriority[priority]
                    const percentage =
                      item.total > 0
                        ? Math.round((item.done / item.total) * 100)
                        : 0

                    return (
                      <div key={priority} className="priority-stat">
                        <div className="priority-stat__label">
                          <span
                            className={`priority-badge priority-badge--${priority}`}
                          >
                            <span
                              className="priority-badge__dot"
                              aria-hidden="true"
                            />
                            {PRIORITY_LABELS[priority]}
                          </span>
                          <span>
                            {item.done}/{item.total}
                          </span>
                        </div>
                        <div className="priority-stat__track">
                          <span
                            className={`priority-stat__fill priority-stat__fill--${priority}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>

            <section className="stats-panel" aria-label="Proyectos">
              <div className="stats-panel__heading">
                <div>
                  <p className="stats-panel__eyebrow">Organización</p>
                  <h3>Proyectos</h3>
                </div>
                <IconCheck className="stats-panel__icon" />
              </div>

              {statistics.projects.length === 0 ? (
                <p className="stats-panel__empty">
                  Aún no has asignado ninguna tarea a un proyecto.
                </p>
              ) : (
                <ul className="project-stats">
                  {statistics.projects.slice(0, 6).map((project) => (
                    <li key={project.project} className="project-stat">
                      <span className="project-stat__name">
                        {project.project}
                      </span>
                      <span className="project-stat__count">
                        {project.done}/{project.total}
                      </span>
                      <span
                        className={`project-stat__pending${
                          project.pending > 0
                            ? ' project-stat__pending--alert'
                            : ''
                        }`}
                      >
                        {project.pending > 0 ? (
                          <>
                            <IconAlert />
                            {project.pending} pendiente
                            {project.pending === 1 ? '' : 's'}
                          </>
                        ) : (
                          <>
                            <IconCheck />
                            Al día
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        <footer className="modal-card__footer">
          <button
            type="button"
            className="button button--primary"
            onClick={onClose}
          >
            Cerrar
          </button>
        </footer>
      </div>
    </dialog>
  )
}
