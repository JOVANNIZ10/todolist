import type { AuthUser, ListMember, TaskList } from '../types'

const SESSION_CACHE_KEY = 'dialista:session-cache'
const SESSION_CACHE_VERSION = 1

export interface CachedSession {
  user: AuthUser
  lists: TaskList[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUser(value: unknown): value is AuthUser {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.email === 'string' &&
    typeof value.createdAt === 'string'
  )
}

function isMember(value: unknown): value is ListMember {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string'
  )
}

function isTaskList(value: unknown): value is TaskList {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.ownerId === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.memberCount === 'number' &&
    typeof value.inviteCode === 'string' &&
    (value.role === 'owner' || value.role === 'member') &&
    Array.isArray(value.members) &&
    value.members.every(isMember)
  )
}

/**
 * Guarda una copia mínima de la sesión para poder abrir la app sin conexión.
 *
 * No contiene cookies ni tokens: solo los datos que la interfaz necesita para
 * mostrar la cuenta, sus listas y la última copia de las tareas. Se borra al
 * cerrar sesión o cuando el servidor responde 401.
 */
export function readCachedSession(): CachedSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_CACHE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (
      !isRecord(parsed) ||
      parsed.version !== SESSION_CACHE_VERSION ||
      !isUser(parsed.user) ||
      !Array.isArray(parsed.lists) ||
      !parsed.lists.every(isTaskList)
    ) {
      return null
    }

    return { user: parsed.user, lists: parsed.lists }
  } catch {
    return null
  }
}

export function saveCachedSession(session: CachedSession): void {
  try {
    window.localStorage.setItem(
      SESSION_CACHE_KEY,
      JSON.stringify({
        version: SESSION_CACHE_VERSION,
        savedAt: new Date().toISOString(),
        ...session,
      }),
    )
  } catch {
    // Es una copia de conveniencia: si no se puede guardar, la app sigue online.
  }
}

export function clearCachedSession(): void {
  try {
    window.localStorage.removeItem(SESSION_CACHE_KEY)
  } catch {
    // Sin acceso a localStorage no hay nada que borrar.
  }
}
