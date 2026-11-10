import { describe, expect, it } from 'vitest'
import {
  addDays,
  dateKeyToDate,
  daysBetween,
  getWeekRange,
  isValidDateKey,
  isValidTime,
  msUntilNextMidnight,
  toDateKey,
  todayKey,
} from './dates'

describe('fechas locales', () => {
  it('convierte una fecha local a clave sin usar UTC', () => {
    const lateAtNight = new Date(2026, 10, 9, 23, 30)
    expect(toDateKey(lateAtNight)).toBe('2026-11-09')
    expect(todayKey(lateAtNight)).toBe('2026-11-09')
  })

  it('valida fechas reales, bisiestos y formatos incorrectos', () => {
    expect(isValidDateKey('2026-11-09')).toBe(true)
    expect(isValidDateKey('2028-02-29')).toBe(true)
    expect(isValidDateKey('2026-02-29')).toBe(false)
    expect(isValidDateKey('2026-02-30')).toBe(false)
    expect(isValidDateKey('2026-13-01')).toBe(false)
    expect(isValidDateKey('9/11/2026')).toBe(false)
    expect(isValidDateKey('')).toBe(false)
    expect(isValidDateKey(null)).toBe(false)
    expect(() => dateKeyToDate('2026-02-30')).toThrow(RangeError)
  })

  it('valida horas en formato de 24 horas', () => {
    expect(isValidTime('00:00')).toBe(true)
    expect(isValidTime('23:59')).toBe(true)
    expect(isValidTime('24:00')).toBe(false)
    expect(isValidTime('12:7')).toBe(false)
    expect(isValidTime('9:30')).toBe(false)
    expect(isValidTime('')).toBe(false)
  })

  it('suma y resta días a través de meses, años y bisiestos', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
  })

  it('mantiene el día correcto en los cambios de horario de verano', () => {
    // En Europa/Madrid el horario de verano empieza el 29/03/2026 y termina
    // el 25/10/2026. Las claves deben avanzar un día natural en ambos casos.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
  })

  it('calcula la semana natural de lunes a domingo', () => {
    expect(getWeekRange('2026-11-09')).toEqual({
      start: '2026-11-09',
      end: '2026-11-15',
    })
    expect(getWeekRange('2026-11-13')).toEqual({
      start: '2026-11-09',
      end: '2026-11-15',
    })
    expect(getWeekRange('2026-11-15')).toEqual({
      start: '2026-11-09',
      end: '2026-11-15',
    })
    expect(getWeekRange('2026-12-31')).toEqual({
      start: '2026-12-28',
      end: '2027-01-03',
    })
  })

  it('calcula los días transcurridos entre fechas sin desfase horario', () => {
    expect(daysBetween('2026-11-07', '2026-11-09')).toBe(2)
    expect(daysBetween('2026-11-09', '2026-11-09')).toBe(0)
    expect(daysBetween('2026-11-10', '2026-11-09')).toBe(-1)
  })

  it('calcula el tiempo hasta la próxima medianoche local', () => {
    const closeToMidnight = new Date(2026, 10, 9, 23, 59, 59, 500)
    expect(msUntilNextMidnight(closeToMidnight)).toBe(600)
    expect(msUntilNextMidnight(new Date(2026, 10, 9, 12, 0))).toBeGreaterThan(
      11 * 60 * 60 * 1000,
    )
  })
})
