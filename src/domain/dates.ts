const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const MS_PER_DAY = 86_400_000

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Convierte una fecha local en `YYYY-MM-DD`.
 * No se usa `toISOString()` porque ese método cambia al día UTC y haría que
 * una tarea de las 23:30 en Madrid terminase asignada al día siguiente.
 */
export function toDateKey(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('La fecha indicada no es válida.')
  }

  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join('-')
}

/**
 * Convierte una clave `YYYY-MM-DD` en una fecha local.
 * Se fija a mediodía para que los cambios de horario de verano/invierno no
 * puedan desplazar el día al sumar o restar fechas.
 */
export function dateKeyToDate(dateKey: string): Date {
  const match = DATE_KEY_PATTERN.exec(dateKey)
  if (!match) {
    throw new RangeError(`La fecha "${dateKey}" no es válida.`)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day, 12, 0, 0, 0)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new RangeError(`La fecha "${dateKey}" no existe en el calendario.`)
  }

  return date
}

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string') return false

  try {
    dateKeyToDate(value)
    return true
  } catch {
    return false
  }
}

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value)
}

/** Devuelve el día local actual, independientemente de la zona UTC. */
export function todayKey(now: Date = new Date()): string {
  return toDateKey(now)
}

/**
 * Suma días usando componentes locales. Al trabajar con claves de fecha y
 * fechas a mediodía, el resultado es estable incluso en los cambios de hora.
 */
export function addDays(dateKey: string, amount: number): string {
  const date = dateKeyToDate(dateKey)
  date.setDate(date.getDate() + amount)
  return toDateKey(date)
}

export function compareDateKeys(first: string, second: string): number {
  return first.localeCompare(second)
}

export function isDateInRange(
  dateKey: string,
  startKey: string,
  endKey: string,
): boolean {
  return dateKey >= startKey && dateKey <= endKey
}

/** Semana natural española: de lunes a domingo. */
export function getWeekRange(referenceDateKey: string): {
  start: string
  end: string
} {
  const date = dateKeyToDate(referenceDateKey)
  const offsetFromMonday = (date.getDay() + 6) % 7
  const start = addDays(referenceDateKey, -offsetFromMonday)

  return { start, end: addDays(start, 6) }
}

/**
 * Días naturales entre dos claves. Se comparan en UTC para que una hora
 * perdida o ganada por el cambio de horario no altere el resultado.
 */
export function daysBetween(startKey: string, endKey: string): number {
  const start = dateKeyToDate(startKey)
  const end = dateKeyToDate(endKey)
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  )
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())

  return Math.round((endUtc - startUtc) / MS_PER_DAY)
}

/** Milisegundos hasta la próxima medianoche local. */
export function msUntilNextMidnight(now: Date = new Date()): number {
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    100,
  )

  return Math.max(250, nextMidnight.getTime() - now.getTime())
}
