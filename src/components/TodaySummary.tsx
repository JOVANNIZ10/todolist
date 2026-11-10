import type { CSSProperties } from 'react'
import { pluralize } from '../lib/formatters'
import type { TodayProgress } from '../types'
import { IconAlert, IconArrowRight, IconCheck } from './Icons'

interface TodaySummaryProps {
  progress: TodayProgress
  overdueCount: number
  onShowOverdue: () => void
}

function getProgressMessage(progress: TodayProgress): {
  eyebrow: string
  title: string
} {
  if (progress.total === 0) {
    return {
      eyebrow: 'Un lienzo en blanco',
      title: 'Añade la primera tarea del día',
    }
  }

  if (progress.pending === 0) {
    return {
      eyebrow: 'Día completado',
      title: 'Todo hecho. Disfruta el resto del día.',
    }
  }

  if (progress.percentage >= 60) {
    return {
      eyebrow: 'Buen ritmo',
      title: `Quedan ${pluralize(progress.pending, 'tarea', 'tareas')} por hacer`,
    }
  }

  return {
    eyebrow: 'Vamos allá',
    title: `Quedan ${pluralize(progress.pending, 'tarea', 'tareas')} por hacer`,
  }
}

export function TodaySummary({
  progress,
  overdueCount,
  onShowOverdue,
}: TodaySummaryProps) {
  const message = getProgressMessage(progress)
  const ringStyle = {
    '--progress-angle': `${progress.percentage * 3.6}deg`,
  } as CSSProperties

  return (
    <section className="day-summary" aria-label="Resumen de hoy">
      <div
        className="progress-ring"
        style={ringStyle}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
        aria-label={`${progress.done} de ${progress.total} tareas hechas hoy`}
      >
        <div className="progress-ring__inner">
          <strong>
            {progress.done}/{progress.total}
          </strong>
          <span>hechas</span>
        </div>
      </div>

      <div className="day-summary__copy">
        <p className="day-summary__eyebrow">{message.eyebrow}</p>
        <h2>{message.title}</h2>
        <p className="day-summary__detail">
          {progress.total === 0
            ? 'Crea una tarea y empieza con buen pie.'
            : progress.pending === 0
              ? 'Has cerrado todas las tareas previstas para hoy.'
              : `Has completado el ${progress.percentage}% de tu día.`}
        </p>
      </div>

      <div className="day-summary__aside">
        {overdueCount > 0 ? (
          <button
            type="button"
            className="overdue-link"
            onClick={onShowOverdue}
          >
            <IconAlert className="overdue-link__icon" />
            <span>
              {pluralize(overdueCount, 'atrasada', 'atrasadas')}
            </span>
            <IconArrowRight className="overdue-link__arrow" />
          </button>
        ) : (
          <span className="day-summary__all-clear">
            <IconCheck /> Sin atrasadas
          </span>
        )}
      </div>
    </section>
  )
}
