import { describe, expect, it } from 'vitest'
import {
  getRecurrenceIntervalLabel,
  isValidRecurrenceRule,
  nextRecurrenceDate,
  normalizeRecurrenceRule,
} from './recurrence'

describe('recurrencia', () => {
  it('valida y normaliza reglas de repetición', () => {
    expect(
      isValidRecurrenceRule({ frequency: 'daily', interval: 1 }),
    ).toBe(true)
    expect(
      isValidRecurrenceRule({ frequency: 'weekly', interval: 0 }),
    ).toBe(false)
    expect(
      isValidRecurrenceRule({ frequency: 'monthly', interval: 1.5 }),
    ).toBe(false)
    expect(
      isValidRecurrenceRule({ frequency: 'yearly', interval: 1 }),
    ).toBe(false)
    expect(normalizeRecurrenceRule(null)).toBeNull()
    expect(
      normalizeRecurrenceRule({
        frequency: 'weekdays',
        interval: 8,
      }),
    ).toEqual({ frequency: 'weekdays', interval: 1 })
  })

  it('calcula la siguiente aparición diaria desde hoy o desde una tarea atrasada', () => {
    const rule = { frequency: 'daily' as const, interval: 1 }

    expect(nextRecurrenceDate('2026-11-09', rule, '2026-11-09')).toBe(
      '2026-11-10',
    )
    expect(nextRecurrenceDate('2026-11-01', rule, '2026-11-09')).toBe(
      '2026-11-10',
    )
    expect(
      nextRecurrenceDate(
        '2026-11-09',
        { frequency: 'daily', interval: 3 },
        '2026-11-09',
      ),
    ).toBe('2026-11-12')
  })

  it('salta los fines de semana en días laborables', () => {
    const rule = { frequency: 'weekdays' as const, interval: 1 }

    // Viernes 13 → lunes 16; sábado 14 → lunes 16.
    expect(nextRecurrenceDate('2026-11-13', rule, '2026-11-13')).toBe(
      '2026-11-16',
    )
    expect(nextRecurrenceDate('2026-11-14', rule, '2026-11-14')).toBe(
      '2026-11-16',
    )
    // Una tarea atrasada del viernes completada el lunes pasa al martes.
    expect(nextRecurrenceDate('2026-11-13', rule, '2026-11-16')).toBe(
      '2026-11-17',
    )
  })

  it('calcula semanas de n en n', () => {
    expect(
      nextRecurrenceDate(
        '2026-11-09',
        { frequency: 'weekly', interval: 2 },
        '2026-11-09',
      ),
    ).toBe('2026-11-23')
  })

  it('ajusta los meses al último día y conserva el día original', () => {
    const monthly = { frequency: 'monthly' as const, interval: 1 }

    expect(nextRecurrenceDate('2026-01-31', monthly, '2026-01-31')).toBe(
      '2026-02-28',
    )
    // Atrasada hasta el 28 de febrero: la siguiente conserva el día 31.
    expect(nextRecurrenceDate('2026-01-31', monthly, '2026-02-28')).toBe(
      '2026-03-31',
    )
    expect(nextRecurrenceDate('2026-03-31', monthly, '2026-03-31')).toBe(
      '2026-04-30',
    )
    expect(nextRecurrenceDate('2026-12-15', monthly, '2026-12-15')).toBe(
      '2027-01-15',
    )
  })

  it('describe las reglas en español', () => {
    expect(
      getRecurrenceIntervalLabel({ frequency: 'daily', interval: 1 }),
    ).toBe('Todos los días')
    expect(
      getRecurrenceIntervalLabel({ frequency: 'daily', interval: 3 }),
    ).toBe('Cada 3 días')
    expect(
      getRecurrenceIntervalLabel({ frequency: 'weekdays', interval: 1 }),
    ).toBe('Días laborables')
    expect(
      getRecurrenceIntervalLabel({ frequency: 'weekly', interval: 2 }),
    ).toBe('Cada 2 semanas')
    expect(
      getRecurrenceIntervalLabel({ frequency: 'monthly', interval: 4 }),
    ).toBe('Cada 4 meses')
  })

  it('rechaza fechas o reglas inválidas', () => {
    expect(() =>
      nextRecurrenceDate(
        '2026-11-09',
        { frequency: 'weekly', interval: 0 },
        '2026-11-09',
      ),
    ).toThrow(RangeError)
    expect(() =>
      nextRecurrenceDate(
        '2026-02-30',
        { frequency: 'daily', interval: 1 },
        '2026-11-09',
      ),
    ).toThrow(RangeError)
  })
})
