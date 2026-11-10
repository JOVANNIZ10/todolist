import type { Task } from '../types'
import { revivePersistedTask } from './taskRepository'

const CACHE_KEY_PREFIX = 'dialista:remote-cache:'
const CACHE_VERSION = 1

interface CacheEnvelope {
  version: number
  savedAt: string
  tasks: unknown[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Última copia de las tareas de una lista remota.
 *
 * Se guarda por identificador de lista para no mezclar cuentas. No es la
 * fuente de verdad: al recuperar la conexión, la instantánea del servidor
 * sustituye estos datos. Su función es que la app pueda abrirse y mostrar algo
 * útil cuando el móvil se queda sin cobertura.
 */
export function readCachedTasks(listId: string): Task[] | null {
  try {
    const raw = window.localStorage.getItem(`${CACHE_KEY_PREFIX}${listId}`)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (
      !isRecord(parsed) ||
      parsed.version !== CACHE_VERSION ||
      !Array.isArray(parsed.tasks)
    ) {
      return null
    }

    const envelope = parsed as unknown as CacheEnvelope
    const tasks: Task[] = []
    const seen = new Set<string>()

    envelope.tasks.forEach((candidate, index) => {
      const task = revivePersistedTask(candidate, index)
      if (!task || seen.has(task.id)) return
      seen.add(task.id)
      tasks.push(task)
    })

    return tasks
  } catch {
    return null
  }
}

export function saveCachedTasks(listId: string, tasks: readonly Task[]): void {
  try {
    window.localStorage.setItem(
      `${CACHE_KEY_PREFIX}${listId}`,
      JSON.stringify({
        version: CACHE_VERSION,
        savedAt: new Date().toISOString(),
        tasks,
      }),
    )
  } catch {
    // La caché es secundaria; si no cabe o está bloqueada, se ignora.
  }
}

export function clearCachedTasks(listId: string): void {
  try {
    window.localStorage.removeItem(`${CACHE_KEY_PREFIX}${listId}`)
  } catch {
    // Sin acceso a localStorage no hay nada que borrar.
  }
}

/** Borra todas las copias de tareas del dispositivo, por ejemplo al cerrar sesión. */
export function clearAllCachedTasks(): void {
  try {
    const { localStorage } = window
    const keys: string[] = []

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith(CACHE_KEY_PREFIX)) keys.push(key)
    }

    keys.forEach((key) => localStorage.removeItem(key))
  } catch {
    // Sin acceso a localStorage no hay nada que borrar.
  }
}
