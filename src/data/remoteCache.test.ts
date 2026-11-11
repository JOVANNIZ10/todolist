import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '../types'
import {
  clearAllCachedTasks,
  clearCachedTasks,
  readCachedTasks,
  saveCachedTasks,
} from './remoteCache'

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

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Comprar pan',
    description: '',
    status: 'pending',
    priority: 'medium',
    assignedDate: '2026-11-10',
    time: null,
    project: null,
    createdAt: '2026-11-10T08:00:00.000Z',
    completedAt: null,
    order: 0,
    subtasks: [],
    recurrence: null,
    reminderMinutes: null,
    reminderNotifiedAt: null,
    recurrenceGenerated: false,
    fixedDaily: false,
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('caché de tareas remotas', () => {
  it('guarda y recupera las tareas de una lista', () => {
    installStorage()
    const tasks = [makeTask(), makeTask({ id: 'task-2', title: 'Regar' })]

    saveCachedTasks('list-1', tasks)

    expect(readCachedTasks('list-1')).toEqual(tasks)
  })

  it('mantiene separadas las copias de cada lista', () => {
    installStorage()

    saveCachedTasks('list-1', [makeTask({ id: 'de-casa' })])
    saveCachedTasks('list-2', [makeTask({ id: 'del-trabajo' })])

    expect(readCachedTasks('list-1')?.map((task) => task.id)).toEqual([
      'de-casa',
    ])
    expect(readCachedTasks('list-2')?.map((task) => task.id)).toEqual([
      'del-trabajo',
    ])
    expect(readCachedTasks('list-3')).toBeNull()
  })

  it('repara tareas dañadas y descarta duplicados o entradas sin base', () => {
    const values = installStorage()
    values.set(
      'dialista:remote-cache:list-1',
      JSON.stringify({
        version: 1,
        savedAt: '2026-11-10T09:00:00.000Z',
        tasks: [
          { id: 'rota', title: '  Título  ', status: 'inventado' },
          { id: 'rota', title: 'Duplicada' },
          { title: 'Sin identificador' },
          null,
        ],
      }),
    )

    const tasks = readCachedTasks('list-1')

    expect(tasks).toHaveLength(1)
    expect(tasks?.[0]).toMatchObject({
      id: 'rota',
      title: 'Título',
      status: 'pending',
      priority: 'medium',
    })
  })

  it('ignora copias corruptas o de otra versión', () => {
    const values = installStorage()

    values.set('dialista:remote-cache:a', '{esto no es json')
    values.set(
      'dialista:remote-cache:b',
      JSON.stringify({ version: 99, tasks: [makeTask()] }),
    )
    values.set(
      'dialista:remote-cache:c',
      JSON.stringify({ version: 1, tasks: 'ninguna' }),
    )

    expect(readCachedTasks('a')).toBeNull()
    expect(readCachedTasks('b')).toBeNull()
    expect(readCachedTasks('c')).toBeNull()
  })

  it('borra solo la copia de la lista indicada', () => {
    installStorage()
    saveCachedTasks('list-1', [makeTask({ id: 'uno' })])
    saveCachedTasks('list-2', [makeTask({ id: 'dos' })])

    clearCachedTasks('list-1')

    expect(readCachedTasks('list-1')).toBeNull()
    expect(readCachedTasks('list-2')).toHaveLength(1)
  })

  it('borra todas las copias de tareas sin tocar el resto de claves', () => {
    const values = installStorage()
    values.set('dialista:data', '{"schemaVersion":2,"tasks":[]}')
    values.set('dialista:session-cache', '{"version":1}')
    saveCachedTasks('list-1', [makeTask({ id: 'uno' })])
    saveCachedTasks('list-2', [makeTask({ id: 'dos' })])

    clearAllCachedTasks()

    expect(readCachedTasks('list-1')).toBeNull()
    expect(readCachedTasks('list-2')).toBeNull()
    expect(values.has('dialista:data')).toBe(true)
    expect(values.has('dialista:session-cache')).toBe(true)
  })

  it('no falla cuando localStorage no está disponible', () => {
    vi.stubGlobal('window', {})

    expect(readCachedTasks('list-1')).toBeNull()
    expect(() => saveCachedTasks('list-1', [makeTask()])).not.toThrow()
    expect(() => clearCachedTasks('list-1')).not.toThrow()
    expect(() => clearAllCachedTasks()).not.toThrow()
  })
})
