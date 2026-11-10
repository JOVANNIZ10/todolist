import { randomUUID } from 'node:crypto'
import type {
  RecurrenceFrequency,
  RecurrenceRule,
  Subtask,
  Task,
  TaskPriority,
  TaskStatus,
} from './types.ts'

export class ValidationError extends Error {}

const STATUSES: readonly TaskStatus[] = ['pending', 'in_progress', 'done']
const PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high']
const FREQUENCIES: readonly RecurrenceFrequency[] = [
  'daily',
  'weekdays',
  'weekly',
  'monthly',
]
const REMINDER_OPTIONS = new Set([0, 10, 30, 60, 1440])

export const MAX_TASK_TITLE = 120
export const MAX_TASK_DESCRIPTION = 5000
export const MAX_PROJECT_NAME = 80
export const MAX_SUBTASKS = 50
export const MAX_SUBTASK_TITLE = 120
export const MAX_TASK_ID = 200
export const MAX_LIST_NAME = 80
export const MAX_NAME = 60
export const MIN_PASSWORD = 8
export const MAX_PASSWORD = 200

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`El campo «${field}» debe ser texto.`)
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new ValidationError(`El campo «${field}» es obligatorio.`)
  }
  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `El campo «${field}» no puede superar los ${maxLength} caracteres.`,
    )
  }

  return trimmed
}

function optionalString(
  value: unknown,
  field: string,
  maxLength: number,
): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') {
    throw new ValidationError(`El campo «${field}» debe ser texto.`)
  }

  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `El campo «${field}» no puede superar los ${maxLength} caracteres.`,
    )
  }

  return trimmed.length > 0 ? trimmed : null
}

function optionalIso(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new ValidationError(`El campo «${field}» no es una fecha válida.`)
  }

  return new Date(value).toISOString()
}

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  if (month < 1 || month > 12 || day < 1 || day > 31) return false

  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function isValidTime(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
    return false
  }

  const [hours, minutes] = value.split(':').map(Number)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

function normalizeRecurrence(value: unknown): RecurrenceRule | null {
  if (value === null || value === undefined) return null
  if (!isRecord(value)) {
    throw new ValidationError('La repetición no es válida.')
  }

  if (!(FREQUENCIES as readonly unknown[]).includes(value.frequency)) {
    throw new ValidationError('La frecuencia de repetición no es válida.')
  }

  const interval = value.interval
  if (
    typeof interval !== 'number' ||
    !Number.isInteger(interval) ||
    interval < 1 ||
    interval > 99
  ) {
    throw new ValidationError('El intervalo de repetición no es válido.')
  }

  return {
    frequency: value.frequency as RecurrenceFrequency,
    interval:
      value.frequency === 'weekdays' ? 1 : interval,
  }
}

function normalizeSubtasks(value: unknown): Subtask[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    throw new ValidationError('Las subtareas no son válidas.')
  }

  const seenIds = new Set<string>()
  const subtasks: Subtask[] = []

  for (const candidate of value) {
    if (!isRecord(candidate)) continue

    const title =
      typeof candidate.title === 'string'
        ? candidate.title.trim().slice(0, MAX_SUBTASK_TITLE)
        : ''
    if (!title) continue

    let id =
      typeof candidate.id === 'string' && candidate.id.trim() !== ''
        ? candidate.id.trim().slice(0, MAX_TASK_ID)
        : `subtask-${randomUUID()}`
    if (seenIds.has(id)) id = `subtask-${randomUUID()}`
    seenIds.add(id)

    subtasks.push({
      id,
      title,
      done: candidate.done === true,
    })

    if (subtasks.length >= MAX_SUBTASKS) break
  }

  return subtasks
}

/**
 * Convierte una tarea recibida por la API en una tarea canónica.
 * Lanza `ValidationError` con un mensaje en español si la base no es válida.
 */
export function normalizeTaskPayload(
  value: unknown,
  now: Date = new Date(),
): Task {
  if (!isRecord(value)) {
    throw new ValidationError('La tarea no tiene un formato válido.')
  }

  const rawId = requiredString(value.id, 'id', MAX_TASK_ID)
  if (rawId.includes('/') || rawId.includes('\\')) {
    throw new ValidationError('El identificador de la tarea no es válido.')
  }

  const status = value.status
  if (!(STATUSES as readonly unknown[]).includes(status)) {
    throw new ValidationError('El estado de la tarea no es válido.')
  }

  const priority = value.priority
  if (!(PRIORITIES as readonly unknown[]).includes(priority)) {
    throw new ValidationError('La prioridad de la tarea no es válida.')
  }

  let assignedDate: string | null = null
  if (value.assignedDate !== null && value.assignedDate !== undefined) {
    if (!isValidDateKey(value.assignedDate)) {
      throw new ValidationError('La fecha asignada no es válida.')
    }
    assignedDate = value.assignedDate
  }

  let time: string | null = null
  if (value.time !== null && value.time !== undefined && value.time !== '') {
    if (!isValidTime(value.time)) {
      throw new ValidationError('La hora de la tarea no es válida.')
    }
    time = value.time
  }

  let reminderMinutes: number | null = null
  if (time && value.reminderMinutes !== null && value.reminderMinutes !== undefined) {
    if (
      typeof value.reminderMinutes !== 'number' ||
      !REMINDER_OPTIONS.has(value.reminderMinutes)
    ) {
      throw new ValidationError('El recordatorio no es válido.')
    }
    reminderMinutes = value.reminderMinutes
  }

  const order =
    typeof value.order === 'number' && Number.isFinite(value.order)
      ? value.order
      : 0

  return {
    id: rawId,
    title: requiredString(value.title, 'título', MAX_TASK_TITLE),
    description:
      typeof value.description === 'string'
        ? value.description.slice(0, MAX_TASK_DESCRIPTION)
        : '',
    status: status as TaskStatus,
    priority: priority as TaskPriority,
    assignedDate,
    time,
    project: optionalString(value.project, 'proyecto', MAX_PROJECT_NAME),
    createdAt:
      optionalIso(value.createdAt, 'creación') ?? now.toISOString(),
    completedAt:
      status === 'done'
        ? optionalIso(value.completedAt, 'finalización') ?? now.toISOString()
        : null,
    order,
    subtasks: normalizeSubtasks(value.subtasks),
    recurrence: normalizeRecurrence(value.recurrence),
    reminderMinutes,
    reminderNotifiedAt:
      status === 'done'
        ? null
        : optionalIso(value.reminderNotifiedAt, 'recordatorio'),
    recurrenceGenerated: value.recurrenceGenerated === true,
  }
}

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError('El correo electrónico es obligatorio.')
  }

  const email = value.trim().toLowerCase()
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
  ) {
    throw new ValidationError('El correo electrónico no es válido.')
  }

  return email
}

function normalizeUserName(value: unknown): string {
  const name = requiredString(value, 'nombre', MAX_NAME)
  return name.replace(/\s+/g, ' ')
}

export interface RegistrationInput {
  name: string
  email: string
  password: string
}

export function normalizeRegistration(value: unknown): RegistrationInput {
  if (!isRecord(value)) {
    throw new ValidationError('Faltan los datos de la cuenta.')
  }

  const name = normalizeUserName(value.name)
  const email = normalizeEmail(value.email)
  const password = value.password

  if (typeof password !== 'string') {
    throw new ValidationError('La contraseña es obligatoria.')
  }
  if (password.length < MIN_PASSWORD) {
    throw new ValidationError(
      `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`,
    )
  }
  if (password.length > MAX_PASSWORD) {
    throw new ValidationError(
      `La contraseña no puede superar los ${MAX_PASSWORD} caracteres.`,
    )
  }

  return { name, email, password }
}

export interface LoginInput {
  email: string
  password: string
}

export function normalizeLogin(value: unknown): LoginInput {
  if (!isRecord(value)) {
    throw new ValidationError('Faltan los datos de acceso.')
  }

  const email = normalizeEmail(value.email)
  const password = value.password

  if (typeof password !== 'string' || password.length === 0) {
    throw new ValidationError('La contraseña es obligatoria.')
  }

  return { email, password }
}

export function normalizeListName(value: unknown): string {
  return requiredString(value, 'nombre de la lista', MAX_LIST_NAME)
}

export function normalizeInviteCode(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError('El código de invitación es obligatorio.')
  }

  const code = value.trim().toUpperCase()
  if (!/^[A-Z0-9]{6,12}$/.test(code)) {
    throw new ValidationError('El código de invitación no es válido.')
  }

  return code
}
