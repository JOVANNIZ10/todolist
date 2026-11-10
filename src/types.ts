export const TASK_STATUSES = ['pending', 'in_progress', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export const RECURRENCE_FREQUENCIES = [
  'daily',
  'weekdays',
  'weekly',
  'monthly',
] as const
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number]

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  /** Cada cuántos días, semanas o meses. En "días laborables" se ignora. */
  interval: number
}

/** Minutos antes de la hora de la tarea. 0 significa "a la hora". */
export const REMINDER_MINUTES_OPTIONS = [0, 10, 30, 60, 1440] as const

/**
 * Modelo persistido de una tarea.
 *
 * Las fechas sin hora se guardan como claves locales `YYYY-MM-DD` para que
 * "hoy" dependa siempre de la zona horaria del dispositivo. Los instantes
 * (creación y finalización) se guardan en ISO 8601.
 *
 * `order` se usa para el orden manual de las tareas.
 */
export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignedDate: string | null
  time: string | null
  project: string | null
  createdAt: string
  completedAt: string | null
  order: number
  subtasks: Subtask[]
  recurrence: RecurrenceRule | null
  reminderMinutes: number | null
  /** Evita repetir el aviso de una misma tarea durante la sesión. */
  reminderNotifiedAt: string | null
  /** Evita generar varias veces la siguiente ocurrencia de una recurrente. */
  recurrenceGenerated: boolean
}

/** Campos editables de una tarea. `assignedDate` vacío se representa con null. */
export interface TaskDraft {
  title: string
  description?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  assignedDate?: string | null
  time?: string | null
  project?: string | null
  subtasks?: readonly Subtask[]
  recurrence?: RecurrenceRule | null
  reminderMinutes?: number | null
}

export type MainViewKey =
  | 'today'
  | 'tomorrow'
  | 'week'
  | 'overdue'
  | 'unscheduled'

export type ViewKey = MainViewKey | 'day'

export type StatusFilter = 'all' | TaskStatus
export type PriorityFilter = 'all' | TaskPriority

export interface TaskFilters {
  status: StatusFilter
  priority: PriorityFilter
  /** null significa "todos los proyectos". */
  project: string | null
  /** Búsqueda libre; cadena vacía significa sin búsqueda. */
  query: string
}

export interface NavigationCounts {
  today: number
  tomorrow: number
  week: number
  overdue: number
  unscheduled: number
}

export interface TodayProgress {
  done: number
  total: number
  pending: number
  percentage: number
}

export type TaskSortMode = 'time' | 'manual'
export type ThemePreference = 'light' | 'dark' | 'system'

export interface AppSettings {
  theme: ThemePreference
  sortMode: TaskSortMode
  browserNotifications: boolean
}

/* -------------------------------------------------------------------------- */
/* Cuentas, listas y sincronización                                           */
/* -------------------------------------------------------------------------- */

export interface AuthUser {
  id: string
  name: string
  email: string
  createdAt: string
}

export interface ListMember {
  id: string
  name: string
}

export interface TaskList {
  id: string
  name: string
  ownerId: string
  createdAt: string
  memberCount: number
  members: ListMember[]
  inviteCode: string
  role: 'owner' | 'member'
}

/** Cambio de una tarea tal y como lo entrega el servidor. */
export interface TaskChange {
  task: Task
  updatedAt: string
  deleted: boolean
}

export interface RejectedTask {
  id: string | null
  error: string
}

export type SyncStatus =
  | 'local'
  | 'connecting'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error'
