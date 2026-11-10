import { describe, expect, it } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION,
  loadTasks,
  revivePersistedTask,
  saveTasks,
  TASK_STORAGE_KEY,
} from './taskRepository'
import type { Task } from '../types'

const BACKUP_PREFIX = 'dialista:backup:'

function createStorage(
  initial: Record<string, string> = {},
): Storage {
  const data = new Map(Object.entries(initial))

  return {
    get length() {
      return data.size
    },
    clear: () => {
      data.clear()
    },
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => {
      data.delete(key)
    },
    setItem: (key: string, value: string) => {
      data.set(key, String(value))
    },
  }
}

function backupKeys(storage: Storage): string[] {
  return Array.from({ length: storage.length }, (_, index) =>
    storage.key(index),
  ).filter((key): key is string => key?.startsWith(BACKUP_PREFIX) ?? false)
}

const LEGACY_TASK = {
  id: 'task-v1',
  title: 'Tarea antigua',
  description: 'Creada en la fase 1',
  status: 'pending',
  priority: 'high',
  assignedDate: '2026-11-09',
  time: '10:00',
  project: 'Casa',
  createdAt: '2026-11-09T08:00:00.000Z',
  completedAt: null,
  order: 3,
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Tarea',
    description: '',
    status: 'pending',
    priority: 'medium',
    assignedDate: '2026-11-09',
    time: null,
    project: null,
    createdAt: '2026-11-09T08:00:00.000Z',
    completedAt: null,
    order: 0,
    subtasks: [],
    recurrence: null,
    reminderMinutes: null,
    reminderNotifiedAt: null,
    recurrenceGenerated: false,
    ...overrides,
  }
}

describe('repositorio de tareas', () => {
  it('devuelve una lista vacía sin aviso cuando no hay datos', () => {
    const result = loadTasks(createStorage())

    expect(result.tasks).toEqual([])
    expect(result.warning).toBeNull()
    expect(result.persistAllowed).toBe(true)
  })

  it('migra datos de la versión 1 y crea una copia de seguridad', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      tasks: [LEGACY_TASK],
    })
    const storage = createStorage({ [TASK_STORAGE_KEY]: raw })
    const result = loadTasks(storage)

    expect(result.warning).toBeNull()
    expect(result.persistAllowed).toBe(true)
    expect(result.tasks).toHaveLength(1)

    const [task] = result.tasks
    expect(task.title).toBe('Tarea antigua')
    expect(task.order).toBe(3)
    expect(task.subtasks).toEqual([])
    expect(task.recurrence).toBeNull()
    expect(task.reminderMinutes).toBeNull()
    expect(task.reminderNotifiedAt).toBeNull()
    expect(task.recurrenceGenerated).toBe(false)

    const backups = backupKeys(storage)
    expect(backups).toHaveLength(1)
    expect(storage.getItem(backups[0])).toBe(raw)
  })

  it('acepta datos de la versión actual sin crear copia', () => {
    const storage = createStorage({
      [TASK_STORAGE_KEY]: JSON.stringify({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        tasks: [makeTask()],
      }),
    })
    const result = loadTasks(storage)

    expect(result.tasks).toHaveLength(1)
    expect(backupKeys(storage)).toHaveLength(0)
  })

  it('repara campos concretos dañados y descarta tareas sin base', () => {
    const raw = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      tasks: [
        {
          id: 'rota',
          title: '  Título con espacios  ',
          status: 'inventado',
          priority: 'urgente',
          assignedDate: '2026-02-30',
          time: '25:99',
          createdAt: 'no-es-fecha',
          completedAt: 'no-es-fecha',
          order: 'primero',
          subtasks: 'ninguna',
          recurrence: { frequency: 'daily', interval: 0 },
          reminderMinutes: 999,
        },
        { title: 'Sin identificador' },
        { id: 'sin-titulo', title: '   ' },
        null,
        'texto',
      ],
    })
    const storage = createStorage({ [TASK_STORAGE_KEY]: raw })
    const result = loadTasks(storage)

    expect(result.tasks).toHaveLength(1)
    expect(result.warning).toContain('4 tarea(s) no se pudieron recuperar')

    const [task] = result.tasks
    expect(task.id).toBe('rota')
    expect(task.title).toBe('Título con espacios')
    expect(task.status).toBe('pending')
    expect(task.priority).toBe('medium')
    expect(task.assignedDate).toBeNull()
    expect(task.time).toBeNull()
    expect(task.completedAt).toBeNull()
    expect(task.subtasks).toEqual([])
    expect(task.recurrence).toBeNull()
    expect(task.reminderMinutes).toBeNull()
    expect(Number.isNaN(Date.parse(task.createdAt))).toBe(false)
  })

  it('evita duplicados por identificador', () => {
    const raw = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      tasks: [makeTask({ id: 'repetida' }), makeTask({ id: 'repetida' })],
    })
    const result = loadTasks(createStorage({ [TASK_STORAGE_KEY]: raw }))

    expect(result.tasks).toHaveLength(1)
    expect(result.warning).toContain('1 tarea(s)')
  })

  it('protege los datos ante un esquema futuro', () => {
    const raw = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
      tasks: [makeTask()],
    })
    const storage = createStorage({ [TASK_STORAGE_KEY]: raw })
    const result = loadTasks(storage)

    expect(result.tasks).toEqual([])
    expect(result.warning).toContain('versión más reciente')
    expect(result.persistAllowed).toBe(false)
    expect(backupKeys(storage)).toHaveLength(0)
  })

  it('crea una copia y arranca vacío si el JSON está dañado', () => {
    const storage = createStorage({
      [TASK_STORAGE_KEY]: '{esto no es json',
    })
    const result = loadTasks(storage)

    expect(result.tasks).toEqual([])
    expect(result.warning).toContain('dañados')
    expect(result.persistAllowed).toBe(true)
    expect(backupKeys(storage)).toHaveLength(1)
  })

  it('avisa cuando el almacenamiento no está disponible', () => {
    const result = loadTasks(null)

    expect(result.tasks).toEqual([])
    expect(result.warning).toContain('almacenamiento local')
    expect(result.persistAllowed).toBe(false)
  })

  it('guarda con la versión actual del esquema', () => {
    const storage = createStorage()
    saveTasks([makeTask()], storage)

    const raw = storage.getItem(TASK_STORAGE_KEY)
    expect(raw).not.toBeNull()

    const parsed = JSON.parse(raw as string)
    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(parsed.tasks).toHaveLength(1)
  })

  it('lanza un error si no puede escribir', () => {
    const storage = createStorage()
    storage.setItem = () => {
      throw new Error('lleno')
    }

    expect(() => saveTasks([makeTask()], storage)).toThrow(
      'No se han podido guardar los cambios.',
    )
  })

  it('normaliza una tarea v1 recuperada conservando sus datos', () => {
    const task = revivePersistedTask(LEGACY_TASK, 5)

    expect(task).not.toBeNull()
    expect(task?.title).toBe('Tarea antigua')
    expect(task?.assignedDate).toBe('2026-11-09')
    expect(task?.time).toBe('10:00')
    expect(task?.project).toBe('Casa')
    expect(task?.subtasks).toEqual([])
  })
})
