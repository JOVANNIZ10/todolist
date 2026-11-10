import { addDays, dateKeyToDate, daysBetween, toDateKey } from './dates'
import {
  RECURRENCE_FREQUENCIES,
  type RecurrenceFrequency,
  type RecurrenceRule,
} from '../types'

export const MAX_RECURRENCE_INTERVAL = 99
const RECURRENCE_SAFETY_LIMIT = 10_000

export function isRecurrenceFrequency(
  value: unknown,
): value is RecurrenceFrequency {
  return (RECURRENCE_FREQUENCIES as readonly unknown[]).includes(value)
}

export function isValidRecurrenceRule(
  value: unknown,
): value is RecurrenceRule {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Record<string, unknown>
  if (!isRecurrenceFrequency(candidate.frequency)) return false
  if (
    typeof candidate.interval !== 'number' ||
    !Number.isInteger(candidate.interval) ||
    candidate.interval < 1 ||
    candidate.interval > MAX_RECURRENCE_INTERVAL
  ) {
    return false
  }

  return true
}

/** Normaliza una regla recibida de la interfaz o de un dato importado. */
export function normalizeRecurrenceRule(
  value: unknown,
): RecurrenceRule | null {
  if (value === null || value === undefined) return null
  if (!isValidRecurrenceRule(value)) return null

  return {
    frequency: value.frequency,
    interval:
      value.frequency === 'weekdays' ? 1 : value.interval,
  }
}

export function getRecurrenceIntervalLabel(rule: RecurrenceRule): string {
  switch (rule.frequency) {
    case 'daily':
      return rule.interval === 1
        ? 'Todos los días'
        : `Cada ${rule.interval} días`
    case 'weekdays':
      return 'Días laborables'
    case 'weekly':
      return rule.interval === 1
        ? 'Cada semana'
        : `Cada ${rule.interval} semanas`
    case 'monthly':
      return rule.interval === 1
        ? 'Cada mes'
        : `Cada ${rule.interval} meses`
  }
}

function addMonthsClamped(dateKey: string, months: number): string {
  const date = dateKeyToDate(dateKey)
  const day = date.getDate()
  const targetMonth = new Date(
    date.getFullYear(),
    date.getMonth() + months,
    1,
    12,
  )
  const lastDay = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0,
    12,
  ).getDate()

  targetMonth.setDate(Math.min(day, lastDay))
  return toDateKey(targetMonth)
}

function isWeekend(dateKey: string): boolean {
  const day = dateKeyToDate(dateKey).getDay()
  return day === 0 || day === 6
}

/**
 * Calcula la siguiente fecha de una tarea recurrente.
 *
 * - La base es la fecha asignada, pero nunca anterior a hoy: una tarea diaria
 *   atrasada varias semanas no genera una cadena de tareas pasadas.
 * - El resultado siempre es posterior a hoy.
 * - En las reglas mensuales, los días 29, 30 y 31 se ajustan al último día del
 *   mes cuando hace falta (por ejemplo, 31 de enero → 28 de febrero).
 */
export function nextRecurrenceDate(
  baseDateKey: string,
  rule: RecurrenceRule,
  todayKeyValue: string,
): string {
  if (!isValidRecurrenceRule(rule)) {
    throw new RangeError('La regla de repetición no es válida.')
  }

  dateKeyToDate(baseDateKey)
  dateKeyToDate(todayKeyValue)

  const base =
    daysBetween(baseDateKey, todayKeyValue) > 0
      ? todayKeyValue
      : baseDateKey

  if (rule.frequency === 'weekdays') {
    let candidate = addDays(base, 1)
    let attempts = 0

    while (isWeekend(candidate) || candidate <= todayKeyValue) {
      candidate = addDays(candidate, 1)
      attempts += 1
      if (attempts > RECURRENCE_SAFETY_LIMIT) {
        throw new RangeError('No se ha podido calcular la siguiente fecha.')
      }
    }

    return candidate
  }

  if (rule.frequency === 'monthly') {
    let factor = 1
    let candidate = addMonthsClamped(baseDateKey, rule.interval)

    while (candidate <= todayKeyValue) {
      factor += 1
      candidate = addMonthsClamped(baseDateKey, rule.interval * factor)
      if (factor > RECURRENCE_SAFETY_LIMIT) {
        throw new RangeError('No se ha podido calcular la siguiente fecha.')
      }
    }

    return candidate
  }

  const step = rule.frequency === 'daily' ? 1 : 7
  let candidate = addDays(base, step * rule.interval)
  let attempts = 0

  while (candidate <= todayKeyValue) {
    candidate = addDays(candidate, step * rule.interval)
    attempts += 1
    if (attempts > RECURRENCE_SAFETY_LIMIT) {
      throw new RangeError('No se ha podido calcular la siguiente fecha.')
    }
  }

  return candidate
}
