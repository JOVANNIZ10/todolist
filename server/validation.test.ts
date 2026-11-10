import { describe, expect, it } from 'vitest'
import {
  ValidationError,
  normalizeInviteCode,
  normalizeListName,
  normalizeLogin,
  normalizeRegistration,
  normalizeTaskPayload,
} from './validation.ts'

function payload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    title: '  Comprar pan  ',
    description: 'Una barra',
    status: 'pending',
    priority: 'medium',
    assignedDate: '2026-05-10',
    time: '18:30',
    project: '  Casa  ',
    createdAt: '2026-05-01T09:00:00.000Z',
    completedAt: null,
    order: 3,
    subtasks: [],
    recurrence: null,
    reminderMinutes: 30,
    reminderNotifiedAt: null,
    recurrenceGenerated: false,
    ...overrides,
  }
}

describe('normalizeTaskPayload', () => {
  it('normaliza textos, recordatorios y subtareas', () => {
    const task = normalizeTaskPayload(
      payload({
        subtasks: [
          { id: 'sub-1', title: '  Leche  ', done: true },
          { id: 'sub-2', title: 'Huevos', done: false },
          { title: '', done: true },
        ],
      }),
      new Date('2026-05-01T10:00:00.000Z'),
    )

    expect(task.title).toBe('Comprar pan')
    expect(task.project).toBe('Casa')
    expect(task.reminderMinutes).toBe(30)
    expect(task.subtasks).toHaveLength(2)
    expect(task.subtasks[0]).toEqual({
      id: 'sub-1',
      title: 'Leche',
      done: true,
    })
  })

  it('ignora el recordatorio si la tarea no tiene hora', () => {
    const task = normalizeTaskPayload(
      payload({ time: null, reminderMinutes: 30 }),
    )
    expect(task.time).toBeNull()
    expect(task.reminderMinutes).toBeNull()
  })

  it('normaliza los días laborables a intervalo uno', () => {
    const task = normalizeTaskPayload(
      payload({
        recurrence: { frequency: 'weekdays', interval: 9 },
      }),
    )
    expect(task.recurrence).toEqual({ frequency: 'weekdays', interval: 1 })
  })

  it('marca completedAt al completar una tarea sin fecha explícita', () => {
    const now = new Date('2026-05-02T11:00:00.000Z')
    const task = normalizeTaskPayload(
      payload({ status: 'done', completedAt: null }),
      now,
    )

    expect(task.completedAt).toBe(now.toISOString())
    expect(task.reminderNotifiedAt).toBeNull()
  })

  it('rechaza datos inválidos', () => {
    expect(() => normalizeTaskPayload(payload({ title: '   ' }))).toThrow(
      ValidationError,
    )
    expect(() => normalizeTaskPayload(payload({ status: 'otro' }))).toThrow(
      ValidationError,
    )
    expect(() =>
      normalizeTaskPayload(payload({ assignedDate: '2026-02-30' })),
    ).toThrow(ValidationError)
    expect(() => normalizeTaskPayload(payload({ time: '25:00' }))).toThrow(
      ValidationError,
    )
    expect(() =>
      normalizeTaskPayload(payload({ reminderMinutes: 7 })),
    ).toThrow(ValidationError)
    expect(() =>
      normalizeTaskPayload(payload({ id: 'ruta/con/barra' })),
    ).toThrow(ValidationError)
  })
})

describe('normalización de cuentas y listas', () => {
  it('limpia el nombre, normaliza el correo y valida la contraseña', () => {
    const registration = normalizeRegistration({
      name: '  Ana   María  ',
      email: '  ANA@Example.COM ',
      password: 'secreto-seguro-123',
    })

    expect(registration.name).toBe('Ana María')
    expect(registration.email).toBe('ana@example.com')

    expect(() =>
      normalizeRegistration({
        name: 'Ana',
        email: 'ana@example.com',
        password: 'corta',
      }),
    ).toThrow(ValidationError)
  })

  it('normaliza el acceso sin recortar la contraseña', () => {
    const login = normalizeLogin({
      email: ' ANA@EXAMPLE.COM ',
      password: ' con espacios ',
    })

    expect(login.email).toBe('ana@example.com')
    expect(login.password).toBe(' con espacios ')
  })

  it('valida nombres y códigos de invitación', () => {
    expect(normalizeListName('  Casa  ')).toBe('Casa')
    expect(normalizeInviteCode(' abcd1234 ')).toBe('ABCD1234')

    expect(() => normalizeListName('   ')).toThrow(ValidationError)
    expect(() => normalizeInviteCode('corto')).toThrow(ValidationError)
    expect(() => normalizeInviteCode('con-guion')).toThrow(ValidationError)
  })
})
