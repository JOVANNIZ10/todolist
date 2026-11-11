import { isValidDateKey, isValidTime } from '../domain/dates'
import {
  isTaskPriority,
  isTaskStatus,
  isValidReminderMinutes,
  markAllSubtasksDone,
  MAX_TITLE_LENGTH,
  normalizeSubtasks,
} from '../domain/tasks'
import { normalizeRecurrenceRule } from '../domain/recurrence'
import {
  REMINDER_MINUTES_OPTIONS,
  type Task,
} from '../types'

const STORAGE_KEY = 'dialista:data'
const BACKUP_PREFIX = 'dialista:backup:'
export const CURRENT_SCHEMA_VERSION = 2

interface PersistedTaskData {
  schemaVersion: number
  tasks: Task[]
}

export interface LoadTasksResult {
  tasks: Task[]
  warning: string | null
  /** false cuando no se deben sobrescribir datos que no hemos podido leer. */
  persistAllowed: boolean
}

function getBrowserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function reviveReminderMinutes(value: unknown): number | null {
  return isValidReminderMinutes(value) &&
    (REMINDER_MINUTES_OPTIONS as readonly number[]).includes(value)
    ? value
    : null
}

/**
 * Normaliza una tarea leída de localStorage o de una copia importada.
 * Los datos corruptos concretos se reparan cuando es posible; si la tarea no
 * tiene una base recuperable (identificador o título), se descarta.
 */
export function revivePersistedTask(
  value: unknown,
  fallbackOrder: number,
): Task | null {
  if (!isRecord(value)) return null

  if (typeof value.id !== 'string' || value.id.trim() === '') return null
  if (typeof value.title !== 'string' || value.title.trim() === '') return null

  const createdAt = isValidIsoTimestamp(value.createdAt)
    ? value.createdAt
    : new Date().toISOString()
  const status = isTaskStatus(value.status) ? value.status : 'pending'
  const priority = isTaskPriority(value.priority) ? value.priority : 'medium'
  const assignedDate =
    typeof value.assignedDate === 'string' &&
    isValidDateKey(value.assignedDate)
      ? value.assignedDate
      : null
  const time =
    typeof value.time === 'string' && isValidTime(value.time)
      ? value.time
      : null
  const order =
    typeof value.order === 'number' && Number.isFinite(value.order)
      ? value.order
      : fallbackOrder
  const completedAt =
    status === 'done' && isValidIsoTimestamp(value.completedAt)
      ? value.completedAt
      : null
  const rawSubtasks = Array.isArray(value.subtasks)
    ? value.subtasks
        .filter(
          (subtask): subtask is Record<string, unknown> =>
            isRecord(subtask) && typeof subtask.title === 'string',
        )
        .map((subtask, index) => ({
          id:
            typeof subtask.id === 'string' && subtask.id.trim() !== ''
              ? subtask.id
              : `subtask-imported-${index}`,
          title: subtask.title as string,
          done: subtask.done === true,
        }))
    : []
  const subtasks = normalizeSubtasks(rawSubtasks)
  const fixedDaily = value.fixedDaily === true

  return {
    id: value.id,
    title: value.title.trim().slice(0, MAX_TITLE_LENGTH),
    description:
      typeof value.description === 'string' ? value.description : '',
    status,
    priority,
    assignedDate,
    time,
    project:
      typeof value.project === 'string' && value.project.trim() !== ''
        ? value.project.trim()
        : null,
    createdAt,
    completedAt,
    order,
    subtasks: status === 'done' ? markAllSubtasksDone(subtasks) : subtasks,
    recurrence: fixedDaily
      ? { frequency: 'daily', interval: 1 }
      : normalizeRecurrenceRule(value.recurrence),
    fixedDaily,
    reminderMinutes: time ? reviveReminderMinutes(value.reminderMinutes) : null,
    reminderNotifiedAt: isValidIsoTimestamp(value.reminderNotifiedAt)
      ? value.reminderNotifiedAt
      : null,
    recurrenceGenerated: value.recurrenceGenerated === true,
  }
}

function backupRawData(storage: Storage, raw: string): void {
  try {
    storage.setItem(`${BACKUP_PREFIX}${Date.now()}`, raw)
  } catch {
    // Si el almacenamiento está lleno o bloqueado, no hay nada más que hacer.
  }
}

export function loadTasks(
  storage: Storage | null = getBrowserStorage(),
): LoadTasksResult {
  if (!storage) {
    return {
      tasks: [],
      warning:
        'El almacenamiento local no está disponible. Puedes usar la aplicación, pero los cambios no se conservarán al cerrar la pestaña.',
      persistAllowed: false,
    }
  }

  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return {
      tasks: [],
      warning:
        'No se ha podido acceder al almacenamiento local. Los cambios no se guardarán.',
      persistAllowed: false,
    }
  }

  if (!raw) {
    return { tasks: [], warning: null, persistAllowed: true }
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || !Array.isArray(parsed.tasks)) {
      throw new Error('Formato de almacenamiento desconocido.')
    }

    const schemaVersion =
      typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 0

    if (schemaVersion > CURRENT_SCHEMA_VERSION) {
      return {
        tasks: [],
        warning:
          'Los datos fueron guardados por una versión más reciente de DíaLista. Actualiza la aplicación para evitar sobrescribirlos.',
        persistAllowed: false,
      }
    }

    // Las versiones 0 y 1 se migran a la versión actual al normalizar las
    // tareas: los campos nuevos reciben valores seguros por defecto.
    if (schemaVersion < CURRENT_SCHEMA_VERSION) {
      backupRawData(storage, raw)
    }

    let skippedTasks = 0
    const seenIds = new Set<string>()
    const tasks: Task[] = []

    parsed.tasks.forEach((candidate, index) => {
      const task = revivePersistedTask(candidate, index)
      if (!task || seenIds.has(task.id)) {
        skippedTasks += 1
        return
      }
      seenIds.add(task.id)
      tasks.push(task)
    })

    return {
      tasks,
      warning:
        skippedTasks > 0
          ? `${skippedTasks} tarea(s) no se pudieron recuperar y se han omitido. El resto está intacto.`
          : null,
      persistAllowed: true,
    }
  } catch {
    backupRawData(storage, raw)
    return {
      tasks: [],
      warning:
        'Los datos guardados estaban dañados o no eran compatibles. Se ha creado una copia de seguridad y la lista se ha iniciado vacía.',
      persistAllowed: true,
    }
  }
}

export function saveTasks(
  tasks: readonly Task[],
  storage: Storage | null = getBrowserStorage(),
): void {
  if (!storage) {
    throw new Error('El almacenamiento local no está disponible.')
  }

  const data: PersistedTaskData = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    tasks: [...tasks],
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    throw new Error(
      'No se han podido guardar los cambios. Comprueba el espacio disponible del navegador.',
    )
  }
}

export const TASK_STORAGE_KEY = STORAGE_KEY
