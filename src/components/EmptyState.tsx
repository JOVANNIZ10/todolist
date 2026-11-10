import type { ComponentType } from 'react'
import type { ViewKey } from '../types'
import {
  IconAlert,
  IconCalendar,
  IconCalendarRange,
  IconInbox,
  IconPlus,
  IconSun,
  IconCalendarCheck,
  type IconProps,
} from './Icons'

interface EmptyContent {
  Icon: ComponentType<IconProps>
  title: string
  description: string
}

function getEmptyContent(view: ViewKey): EmptyContent {
  switch (view) {
    case 'today':
      return {
        Icon: IconSun,
        title: 'Hoy está libre',
        description:
          'Cuando tengas algo que hacer, añádelo aquí y empieza con buen pie.',
      }
    case 'tomorrow':
      return {
        Icon: IconCalendar,
        title: 'Mañana, sin planes todavía',
        description:
          'Las tareas que asignes a mañana aparecerán aquí automáticamente.',
      }
    case 'week':
      return {
        Icon: IconCalendarRange,
        title: 'Semana despejada',
        description:
          'No hay tareas con fecha entre el lunes y el domingo de esta semana.',
      }
    case 'overdue':
      return {
        Icon: IconCalendarCheck,
        title: 'Nada atrasado',
        description:
          'Vas al día. Las tareas pendientes de días anteriores aparecerán aquí.',
      }
    case 'unscheduled':
      return {
        Icon: IconInbox,
        title: 'Sin tareas en el limbo',
        description:
          'Aquí viven las tareas que todavía no tienen un día asignado.',
      }
    case 'day':
      return {
        Icon: IconCalendar,
        title: 'Este día está libre',
        description:
          'Puedes crear una tarea para esta fecha o elegir otro día en el calendario.',
      }
    default:
      return {
        Icon: IconPlus,
        title: 'No hay tareas',
        description: 'Crea una tarea para empezar.',
      }
  }
}

interface EmptyStateProps {
  view: ViewKey
  hasFilters: boolean
  onCreate: () => void
  onClearFilters: () => void
}

export function EmptyState({
  view,
  hasFilters,
  onCreate,
  onClearFilters,
}: EmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="empty-state">
        <span className="empty-state__icon">
          <IconAlert />
        </span>
        <p className="empty-state__eyebrow">Filtros activos</p>
        <h3>Sin coincidencias</h3>
        <p>
          Ninguna tarea de esta vista cumple los filtros seleccionados.
        </p>
        <button
          type="button"
          className="button button--secondary"
          onClick={onClearFilters}
        >
          Limpiar filtros
        </button>
      </div>
    )
  }

  const { Icon, title, description } = getEmptyContent(view)

  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <Icon />
      </span>
      <p className="empty-state__eyebrow">Todo en orden</p>
      <h3>{title}</h3>
      <p>{description}</p>
      <button
        type="button"
        className="button button--secondary"
        onClick={onCreate}
      >
        <IconPlus />
        Crear tarea
      </button>
    </div>
  )
}
