import {
  CURRENT_SCHEMA_VERSION,
  revivePersistedTask,
} from './taskRepository'
import type { Task } from '../types'

interface TaskBackup {
  app: 'DiaLista'
  schemaVersion: number
  exportedAt: string
  tasks: Task[]
}

export interface ParsedTaskBackup {
  tasks: Task[]
  skipped: number
  sourceVersion: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function serializeTaskBackup(
  tasks: readonly Task[],
  now: Date = new Date(),
): string {
  const backup: TaskBackup = {
    app: 'DiaLista',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    tasks: [...tasks],
  }

  return JSON.stringify(backup, null, 2)
}

/**
 * Acepta tanto una copia de DíaLista como una lista de tareas sin envoltorio.
 * Las tareas de versiones anteriores se normalizan con valores por defecto.
 */
export function parseTaskBackup(raw: string): ParsedTaskBackup {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('El archivo no contiene un JSON válido.')
  }

  let candidates: unknown[]
  let sourceVersion = 0

  if (Array.isArray(parsed)) {
    candidates = parsed
  } else if (isRecord(parsed) && Array.isArray(parsed.tasks)) {
    candidates = parsed.tasks
    sourceVersion =
      typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 0
  } else {
    throw new Error(
      'El archivo no tiene el formato de copia de seguridad de DíaLista.',
    )
  }

  if (sourceVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      'La copia fue creada por una versión más reciente de DíaLista.',
    )
  }

  if (candidates.length === 0) {
    throw new Error('La copia no contiene tareas.')
  }

  const seenIds = new Set<string>()
  const tasks: Task[] = []
  let skipped = 0

  candidates.forEach((candidate, index) => {
    const task = revivePersistedTask(candidate, index)
    if (!task || seenIds.has(task.id)) {
      skipped += 1
      return
    }
    seenIds.add(task.id)
    tasks.push(task)
  })

  if (tasks.length === 0) {
    throw new Error('La copia no contiene ninguna tarea válida.')
  }

  return { tasks, skipped, sourceVersion }
}
