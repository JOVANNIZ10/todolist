import { getRecurrenceIntervalLabel } from '../domain/recurrence'
import type {
  PriorityFilter,
  RecurrenceRule,
  StatusFilter,
  SyncStatus,
  TaskPriority,
  TaskSortMode,
  TaskStatus,
  ThemePreference,
} from '../types'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  done: 'Hecha',
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
}

export const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'Todas',
  pending: 'Pendientes',
  in_progress: 'En progreso',
  done: 'Hechas',
}

export const PRIORITY_FILTER_LABELS: Record<PriorityFilter, string> = {
  all: 'Todas',
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
}

export const TASK_STATUS_OPTIONS = [
  { value: 'pending', label: STATUS_LABELS.pending },
  { value: 'in_progress', label: STATUS_LABELS.in_progress },
  { value: 'done', label: STATUS_LABELS.done },
] as const

export const TASK_PRIORITY_OPTIONS = [
  { value: 'low', label: PRIORITY_LABELS.low },
  { value: 'medium', label: PRIORITY_LABELS.medium },
  { value: 'high', label: PRIORITY_LABELS.high },
] as const

export const RECURRENCE_FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Todos los días' },
  { value: 'weekdays', label: 'Días laborables' },
  { value: 'weekly', label: 'Cada semana' },
  { value: 'monthly', label: 'Cada mes' },
] as const

export const REMINDER_OPTIONS = [
  { value: '', label: 'Sin recordatorio' },
  { value: '0', label: 'A la hora' },
  { value: '10', label: '10 minutos antes' },
  { value: '30', label: '30 minutos antes' },
  { value: '60', label: '1 hora antes' },
  { value: '1440', label: '1 día antes' },
] as const

export function formatRecurrence(rule: RecurrenceRule | null): string | null {
  return rule ? getRecurrenceIntervalLabel(rule) : null
}

export function formatReminder(minutes: number | null): string | null {
  switch (minutes) {
    case 0:
      return 'A la hora'
    case 10:
      return '10 minutos antes'
    case 30:
      return '30 minutos antes'
    case 60:
      return '1 hora antes'
    case 1440:
      return '1 día antes'
    default:
      return null
  }
}

export const SORT_MODE_LABELS: Record<TaskSortMode, string> = {
  time: 'Por hora',
  manual: 'Manual',
}

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: 'Claro',
  dark: 'Oscuro',
  system: 'Sistema',
}

export const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  local: 'Solo en este dispositivo',
  connecting: 'Conectando…',
  syncing: 'Sincronizando…',
  synced: 'Sincronizado',
  offline: 'Sin conexión',
  error: 'Error de sincronización',
}
