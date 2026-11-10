import { describe, expect, it } from 'vitest'
import {
  parseTaskBackup,
  serializeTaskBackup,
} from './taskTransfer'
import { CURRENT_SCHEMA_VERSION } from './taskRepository'
import type { Task } from '../types'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Tarea de prueba',
    description: 'Con detalles',
    status: 'pending',
    priority: 'high',
    assignedDate: '2026-11-09',
    time: '10:00',
    project: 'Casa',
    createdAt: '2026-11-09T08:00:00.000Z',
    completedAt: null,
    order: 0,
    subtasks: [{ id: 'sub-1', title: 'Primer paso', done: false }],
    recurrence: { frequency: 'weekly', interval: 1 },
    reminderMinutes: 30,
    reminderNotifiedAt: null,
    recurrenceGenerated: false,
    ...overrides,
  }
}

describe('copias de seguridad', () => {
  const exportedAt = new Date(2026, 10, 9, 12, 0, 0)

  it('serializa con metadatos y vuelve a leer la copia', () => {
    const tasks = [makeTask()]
    const json = serializeTaskBackup(tasks, exportedAt)
    const parsed = JSON.parse(json)

    expect(parsed.app).toBe('DiaLista')
    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(parsed.exportedAt).toBe(exportedAt.toISOString())
    expect(parsed.tasks).toHaveLength(1)

    const result = parseTaskBackup(json)
    expect(result.tasks).toHaveLength(1)
    expect(result.skipped).toBe(0)
    expect(result.sourceVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(result.tasks[0]).toEqual(tasks[0])
  })

  it('acepta una lista de tareas sin envoltorio', () => {
    const result = parseTaskBackup(JSON.stringify([makeTask()]))

    expect(result.tasks).toHaveLength(1)
    expect(result.sourceVersion).toBe(0)
  })

  it('migra tareas antiguas añadiendo los campos de la fase 2', () => {
    const legacy = {
      id: 'antigua',
      title: 'Tarea de la fase 1',
      status: 'done',
      priority: 'low',
      assignedDate: '2026-11-01',
      time: null,
      project: null,
      createdAt: '2026-11-01T09:00:00.000Z',
      completedAt: '2026-11-01T10:00:00.000Z',
      order: 2,
    }
    const result = parseTaskBackup(JSON.stringify([legacy]))

    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].subtasks).toEqual([])
    expect(result.tasks[0].recurrence).toBeNull()
    expect(result.tasks[0].reminderMinutes).toBeNull()
    expect(result.tasks[0].recurrenceGenerated).toBe(false)
    expect(result.tasks[0].completedAt).toBe(legacy.completedAt)
  })

  it('omite entradas no válidas y duplicadas, pero conserva las buenas', () => {
    const result = parseTaskBackup(
      JSON.stringify({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        tasks: [
          makeTask({ id: 'buena' }),
          makeTask({ id: 'buena' }),
          { title: 'Sin id' },
          null,
        ],
      }),
    )

    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].id).toBe('buena')
    expect(result.skipped).toBe(3)
  })

  it('rechaza JSON inválido, formatos desconocidos y copias futuras', () => {
    expect(() => parseTaskBackup('{roto')).toThrow(
      'El archivo no contiene un JSON válido.',
    )
    expect(() => parseTaskBackup('{"otra":"cosa"}')).toThrow(
      'El archivo no tiene el formato de copia de seguridad de DíaLista.',
    )
    expect(() =>
      parseTaskBackup(
        JSON.stringify({
          schemaVersion: CURRENT_SCHEMA_VERSION + 1,
          tasks: [makeTask()],
        }),
      ),
    ).toThrow('La copia fue creada por una versión más reciente')
  })

  it('rechaza copias vacías o sin ninguna tarea válida', () => {
    expect(() => parseTaskBackup('[]')).toThrow(
      'La copia no contiene tareas.',
    )
    expect(() =>
      parseTaskBackup(
        JSON.stringify({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          tasks: [{ title: 'sin id' }],
        }),
      ),
    ).toThrow('La copia no contiene ninguna tarea válida.')
  })
})
