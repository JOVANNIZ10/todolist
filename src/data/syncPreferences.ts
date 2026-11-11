import type { Task } from '../types'

const MIGRATION_PREFIX = 'dialista:migration:'

/**
 * Firma estable de las tareas locales. Permite recordar qué conjunto de tareas
 * ya se copió (o se descartó) para una lista sin volver a avisar en cada
 * inicio de sesión. Si el usuario crea tareas locales nuevas, la firma cambia
 * y el aviso vuelve a aparecer.
 */
export function migrationFingerprint(tasks: readonly Task[]): string {
  return tasks
    .map((task) => task.id)
    .sort()
    .join('|')
}

function getStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readMigrationFingerprint(listId: string): string | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    return storage.getItem(`${MIGRATION_PREFIX}${listId}`)
  } catch {
    return null
  }
}

export function saveMigrationFingerprint(
  listId: string,
  fingerprint: string,
): void {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(`${MIGRATION_PREFIX}${listId}`, fingerprint)
  } catch {
    // El aviso volverá a aparecer; la migración en sí ya se ha aplicado.
  }
}
