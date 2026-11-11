import {
  dateKeyToDate,
  daysBetween,
  isValidDateKey,
  isValidTime,
  todayKey,
} from './dates'
import {
  nextRecurrenceDate,
  normalizeRecurrenceRule,
} from './recurrence'
import {
  REMINDER_MINUTES_OPTIONS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type RecurrenceRule,
  type Subtask,
  type Task,
  type TaskDraft,
  type TaskPriority,
  type TaskSortMode,
  type TaskStatus,
} from '../types'

export const MAX_TITLE_LENGTH = 120
export const MAX_SUBTASK_LENGTH = 120
export const MAX_SUBTASKS = 50
export const REMINDER_GRACE_MS = 6 * 60 * 60 * 1000

export interface TaskValidationErrors {
  title?: string
  assignedDate?: string
  time?: string
  reminder?: string
}

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return normalized.length > 0 ? normalized : null
}

function normalizeRequiredText(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function generateId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function generateTaskId(): string {
  return generateId('task')
}

export function createSubtask(
  title = '',
  done = false,
  id = generateId('subtask'),
): Subtask {
  return { id, title, done }
}

/** Limpia subtareas vacías, recorta longitudes y evita identificadores repetidos. */
export function normalizeSubtasks(
  subtasks: readonly Subtask[] | undefined,
): Subtask[] {
  if (!subtasks) return []

  const seenIds = new Set<string>()
  const normalized: Subtask[] = []

  for (const subtask of subtasks) {
    const title = normalizeRequiredText(subtask.title)
    if (!title) continue

    let id =
      typeof subtask.id === 'string' && subtask.id.trim() !== ''
        ? subtask.id
        : generateId('subtask')

    if (seenIds.has(id)) {
      id = generateId('subtask')
    }

    seenIds.add(id)
    normalized.push({
      id,
      title: title.slice(0, MAX_SUBTASK_LENGTH),
      done: Boolean(subtask.done),
    })

    if (normalized.length >= MAX_SUBTASKS) break
  }

  return normalized
}

export function isValidReminderMinutes(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 60 * 24 * 30
  )
}

function normalizeReminderMinutes(value: unknown): number | null {
  if (!isValidReminderMinutes(value)) return null

  return (REMINDER_MINUTES_OPTIONS as readonly number[]).includes(value)
    ? value
    : null
}

export function markAllSubtasksDone(subtasks: readonly Subtask[]): Subtask[] {
  return subtasks.map((subtask) =>
    subtask.done ? subtask : { ...subtask, done: true },
  )
}

function completionTimestampForStatus(
  status: TaskStatus,
  previousTask: Pick<Task, 'status' | 'completedAt'> | undefined,
  now: Date,
): string | null {
  if (status !== 'done') return null
  if (previousTask?.status === 'done' && previousTask.completedAt) {
    return previousTask.completedAt
  }
  return now.toISOString()
}

function sameRecurrence(
  first: RecurrenceRule | null,
  second: RecurrenceRule | null,
): boolean {
  if (first === null || second === null) return first === second
  return (
    first.frequency === second.frequency &&
    first.interval === second.interval
  )
}

const DAILY_RECURRENCE: RecurrenceRule = {
  frequency: 'daily',
  interval: 1,
}

function normalizeDailyRule(
  fixedDaily: boolean,
  recurrence: RecurrenceRule | null,
): RecurrenceRule | null {
  return fixedDaily ? DAILY_RECURRENCE : recurrence
}

export function validateTaskDraft(draft: TaskDraft): TaskValidationErrors {
  const errors: TaskValidationErrors = {}
  const title = normalizeRequiredText(draft.title)

  if (!title) {
    errors.title = 'El título es obligatorio.'
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.title = `El título no puede superar los ${MAX_TITLE_LENGTH} caracteres.`
  }

  if (
    draft.assignedDate !== undefined &&
    draft.assignedDate !== null &&
    !isValidDateKey(draft.assignedDate)
  ) {
    errors.assignedDate = 'La fecha no es válida.'
  }

  if (
    draft.time !== undefined &&
    draft.time !== null &&
    draft.time.trim() !== '' &&
    !isValidTime(draft.time.trim())
  ) {
    errors.time = 'La hora no es válida.'
  }

  if (
    draft.reminderMinutes !== undefined &&
    draft.reminderMinutes !== null &&
    !isValidReminderMinutes(draft.reminderMinutes)
  ) {
    errors.reminder = 'El recordatorio no es válido.'
  }

  const timeValue = draft.time?.trim() ?? ''
  if (
    draft.reminderMinutes !== undefined &&
    draft.reminderMinutes !== null &&
    draft.time !== undefined &&
    timeValue === ''
  ) {
    errors.reminder = 'Añade una hora para activar el recordatorio.'
  }

  if (draft.recurrence !== undefined && draft.recurrence !== null) {
    if (normalizeRecurrenceRule(draft.recurrence) === null) {
      errors.assignedDate = 'La repetición no es válida.'
    }
  }

  return errors
}

export function hasTaskValidationErrors(errors: TaskValidationErrors): boolean {
  return Object.keys(errors).length > 0
}

export function createTask(
  draft: TaskDraft,
  now: Date = new Date(),
  order = 0,
): Task {
  const errors = validateTaskDraft(draft)
  if (hasTaskValidationErrors(errors)) {
    throw new Error(Object.values(errors)[0])
  }

  const status = draft.status ?? 'pending'
  const today = todayKey(now)
  const fixedDaily = draft.fixedDaily === true
  let assignedDate =
    draft.assignedDate === undefined
      ? today
      : normalizeOptionalText(draft.assignedDate)
  if (fixedDaily && (assignedDate === null || assignedDate < today)) {
    assignedDate = today
  }
  const time = normalizeOptionalText(draft.time)
  const subtasks = normalizeSubtasks(draft.subtasks)

  return {
    id: generateTaskId(),
    title: normalizeRequiredText(draft.title),
    description: normalizeRequiredText(draft.description),
    status,
    priority: draft.priority ?? 'medium',
    assignedDate,
    time,
    project: normalizeOptionalText(draft.project),
    createdAt: now.toISOString(),
    completedAt: completionTimestampForStatus(status, undefined, now),
    order,
    subtasks:
      status === 'done' ? markAllSubtasksDone(subtasks) : subtasks,
    recurrence: normalizeDailyRule(
      fixedDaily,
      normalizeRecurrenceRule(draft.recurrence),
    ),
    fixedDaily,
    reminderMinutes: time
      ? normalizeReminderMinutes(draft.reminderMinutes)
      : null,
    reminderNotifiedAt: null,
    recurrenceGenerated: false,
  }
}

/**
 * Aplica cambios conservando `id`, `createdAt` y `order`.
 * Si la tarea pasa a "hecha", se sella la hora de finalización y se marcan sus
 * subtareas como hechas; si se reabre, se limpia la finalización.
 */
export function updateTask(
  task: Task,
  draft: TaskDraft,
  now: Date = new Date(),
): Task {
  const errors = validateTaskDraft(draft)
  if (hasTaskValidationErrors(errors)) {
    throw new Error(Object.values(errors)[0])
  }

  const status = draft.status ?? task.status
  const fixedDaily =
    draft.fixedDaily === undefined
      ? task.fixedDaily
      : draft.fixedDaily === true
  let assignedDate =
    draft.assignedDate === undefined
      ? task.assignedDate
      : normalizeOptionalText(draft.assignedDate)
  const today = todayKey(now)
  if (
    fixedDaily &&
    status !== 'done' &&
    !task.recurrenceGenerated &&
    (assignedDate === null || assignedDate < today)
  ) {
    assignedDate = today
  }
  const time =
    draft.time === undefined ? task.time : normalizeOptionalText(draft.time)
  const recurrence = normalizeDailyRule(
    fixedDaily,
    draft.recurrence === undefined
      ? task.recurrence
      : normalizeRecurrenceRule(draft.recurrence),
  )
  const reminderMinutes =
    draft.reminderMinutes === undefined
      ? task.reminderMinutes
      : normalizeReminderMinutes(draft.reminderMinutes)
  const nextReminderMinutes = time ? reminderMinutes : null
  const scheduleChanged =
    assignedDate !== task.assignedDate ||
    time !== task.time ||
    nextReminderMinutes !== task.reminderMinutes

  let subtasks =
    draft.subtasks === undefined
      ? task.subtasks
      : normalizeSubtasks(draft.subtasks)
  if (status === 'done') {
    subtasks = markAllSubtasksDone(subtasks)
  }

  return {
    ...task,
    title: normalizeRequiredText(draft.title),
    description:
      draft.description === undefined
        ? task.description
        : normalizeRequiredText(draft.description),
    status,
    priority: draft.priority ?? task.priority,
    assignedDate,
    time,
    project:
      draft.project === undefined
        ? task.project
        : normalizeOptionalText(draft.project),
    completedAt: completionTimestampForStatus(status, task, now),
    subtasks,
    recurrence,
    fixedDaily,
    reminderMinutes: nextReminderMinutes,
    reminderNotifiedAt: scheduleChanged ? null : task.reminderNotifiedAt,
    recurrenceGenerated:
      fixedDaily === task.fixedDaily &&
      recurrence !== null &&
      sameRecurrence(recurrence, task.recurrence)
        ? task.recurrenceGenerated
        : false,
  }
}

export function changeTaskStatus(
  task: Task,
  status: TaskStatus,
  now: Date = new Date(),
): Task {
  return {
    ...task,
    status,
    completedAt: completionTimestampForStatus(status, task, now),
    subtasks:
      status === 'done'
        ? markAllSubtasksDone(task.subtasks)
        : task.subtasks,
  }
}

export function toggleSubtask(
  task: Task,
  subtaskId: string,
): Task {
  return {
    ...task,
    subtasks: task.subtasks.map((subtask) =>
      subtask.id === subtaskId
        ? { ...subtask, done: !subtask.done }
        : subtask,
    ),
  }
}

export function isTaskOverdue(task: Task, today: string): boolean {
  return (
    task.status !== 'done' &&
    task.assignedDate !== null &&
    task.assignedDate < today
  )
}

/**
 * Crea la siguiente aparición de una tarea recurrente. La tarea original se
 * conserva como completada y la nueva nace pendiente, sin subtareas hechas y
 * sin recordatorio ya enviado.
 */
export function createNextRecurringTask(
  task: Task,
  today: string,
  now: Date = new Date(),
  order = task.order + 1,
): Task | null {
  if (!task.recurrence || task.recurrenceGenerated) return null

  const baseDate = task.assignedDate ?? today
  const assignedDate = nextRecurrenceDate(baseDate, task.recurrence, today)

  return {
    ...task,
    id: generateTaskId(),
    status: 'pending',
    assignedDate,
    createdAt: now.toISOString(),
    completedAt: null,
    order,
    subtasks: task.subtasks.map((subtask) =>
      createSubtask(subtask.title, false),
    ),
    reminderMinutes: task.reminderMinutes,
    reminderNotifiedAt: null,
    recurrenceGenerated: false,
  }
}

export function markRecurrenceGenerated(task: Task): Task {
  return task.recurrenceGenerated
    ? task
    : { ...task, recurrenceGenerated: true }
}

/** Instante local en el que debe saltar el recordatorio, si procede. */
export function getReminderDueAt(task: Task): Date | null {
  if (
    !task.assignedDate ||
    !task.time ||
    task.reminderMinutes === null ||
    !isValidReminderMinutes(task.reminderMinutes)
  ) {
    return null
  }

  const [hours, minutes] = task.time.split(':').map(Number)
  const date = dateKeyToDate(task.assignedDate)
  date.setHours(hours, minutes, 0, 0)

  return new Date(date.getTime() - task.reminderMinutes * 60_000)
}

export function isReminderDue(
  task: Task,
  now: Date = new Date(),
  graceMs = REMINDER_GRACE_MS,
): boolean {
  if (task.status === 'done' || task.reminderNotifiedAt !== null) {
    return false
  }

  const dueAt = getReminderDueAt(task)
  if (!dueAt) return false

  const elapsed = now.getTime() - dueAt.getTime()
  return elapsed >= 0 && elapsed <= graceMs
}

export function isSubtaskProgress(task: Task): {
  done: number
  total: number
} {
  return {
    done: task.subtasks.filter((subtask) => subtask.done).length,
    total: task.subtasks.length,
  }
}

/**
 * Orden por defecto: hora ascendente, sin hora al final, luego prioridad.
 * En modo manual se respeta exclusivamente `order`.
 */
export function sortTasks(
  tasks: readonly Task[],
  mode: TaskSortMode = 'time',
): Task[] {
  return [...tasks].sort((first, second) => {
    if (mode === 'manual') {
      if (first.order !== second.order) return first.order - second.order
      return first.createdAt.localeCompare(second.createdAt)
    }

    const firstTime = first.time ?? '99:99'
    const secondTime = second.time ?? '99:99'
    const timeComparison = firstTime.localeCompare(secondTime)
    if (timeComparison !== 0) return timeComparison

    const priorityComparison =
      PRIORITY_WEIGHT[first.priority] - PRIORITY_WEIGHT[second.priority]
    if (priorityComparison !== 0) return priorityComparison

    if (first.order !== second.order) return first.order - second.order
    return first.createdAt.localeCompare(second.createdAt)
  })
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return (TASK_STATUSES as readonly unknown[]).includes(value)
}

export function isTaskPriority(value: unknown): value is TaskPriority {
  return (TASK_PRIORITIES as readonly unknown[]).includes(value)
}

export function nextTaskOrder(tasks: readonly Task[]): number {
  return tasks.reduce(
    (highestOrder, task) => Math.max(highestOrder, task.order),
    -1,
  ) + 1
}

export function getTaskAgeInDays(task: Task, today: string): number {
  return task.assignedDate
    ? Math.max(0, daysBetween(task.assignedDate, today))
    : 0
}
