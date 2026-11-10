import { addDays, dateKeyToDate } from '../domain/dates'

const LOCALE = 'es-ES'

export function capitalizeFirst(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function formatFullDate(
  dateKey: string,
  includeYear = true,
): string {
  const formatted = new Intl.DateTimeFormat(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(includeYear ? { year: 'numeric' } : {}),
  }).format(dateKeyToDate(dateKey))

  return capitalizeFirst(formatted)
}

export function formatCompactDate(dateKey: string): string {
  return capitalizeFirst(
    new Intl.DateTimeFormat(LOCALE, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(dateKeyToDate(dateKey)),
  )
}

export function formatTaskDate(
  dateKey: string | null,
  today: string,
): string {
  if (!dateKey) return 'Sin fecha'
  if (dateKey === today) return 'Hoy'
  if (dateKey === addDays(today, 1)) return 'Mañana'

  return formatCompactDate(dateKey)
}

export function formatWeekRange(startKey: string, endKey: string): string {
  const start = dateKeyToDate(startKey)
  const end = dateKeyToDate(endKey)

  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()
  ) {
    const monthAndYear = new Intl.DateTimeFormat(LOCALE, {
      month: 'long',
      year: 'numeric',
    }).format(end)
    return `${start.getDate()} – ${end.getDate()} de ${monthAndYear}`
  }

  const formatter = new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `${formatter.format(start)} – ${formatter.format(end)}`
}

export function formatTime(isoTimestamp: string | null): string | null {
  if (!isoTimestamp) return null
  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatOverdueAge(
  assignedDate: string,
  daysLate: number,
): string {
  if (daysLate <= 0) return 'Atrasada'
  if (daysLate === 1) return 'Atrasada desde ayer'
  if (daysLate < 7) {
    return `Atrasada desde hace ${daysLate} días`
  }

  const formattedDate = new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
  }).format(dateKeyToDate(assignedDate))

  return `Atrasada desde el ${formattedDate}`
}

export function pluralize(
  count: number,
  singular: string,
  plural: string,
): string {
  return `${count} ${count === 1 ? singular : plural}`
}
