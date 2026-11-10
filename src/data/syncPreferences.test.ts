import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '../types'
import {
  migrationFingerprint,
  readMigrationFingerprint,
  saveMigrationFingerprint,
} from './syncPreferences'

function makeTask(id: string): Task {
  return {
    id,
    title: `Tarea ${id}`,
    description: '',
    status: 'pending',
    priority: 'medium',
    assignedDate: null,
    time: null,
    project: null,
    createdAt: '2026-01-01T09:00:00.000Z',
    completedAt: null,
    order: 0,
    subtasks: [],
    recurrence: null,
    reminderMinutes: null,
    reminderNotifiedAt: null,
    recurrenceGenerated: false,
  }
}

function installStorage(): Map<string, string> {
  const values = new Map<string, string>()

  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size
      },
    },
  })

  return values
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('migrationFingerprint', () => {
  it('genera una firma estable y ordenada por identificador', () => {
    const forward = migrationFingerprint([makeTask('a'), makeTask('b')])
    const backward = migrationFingerprint([makeTask('b'), makeTask('a')])

    expect(forward).toBe('a|b')
    expect(backward).toBe(forward)
  })

  it('cambia cuando se añaden o eliminan tareas locales', () => {
    const original = migrationFingerprint([makeTask('a')])

    expect(
      migrationFingerprint([makeTask('a'), makeTask('b')]),
    ).not.toBe(original)
    expect(migrationFingerprint([])).toBe('')
  })
})

describe('firma persistida de migración', () => {
  it('guarda la firma por lista y no la comparte entre listas', () => {
    installStorage()

    saveMigrationFingerprint('list-1', 'a|b')

    expect(readMigrationFingerprint('list-1')).toBe('a|b')
    expect(readMigrationFingerprint('list-2')).toBeNull()
  })

  it('tolera que localStorage no esté disponible', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('bloqueado')
      },
    })

    expect(readMigrationFingerprint('list-1')).toBeNull()
    expect(() => saveMigrationFingerprint('list-1', 'a')).not.toThrow()
  })
})
