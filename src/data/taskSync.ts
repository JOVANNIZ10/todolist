import type { Task, TaskChange } from '../types'

export interface TaskDiff {
  upserts: Task[]
  deletedIds: string[]
}

/**
 * Compara dos estados por identidad de objeto. Las operaciones de dominio
 * crean objetos nuevos solo para las tareas que cambian, de modo que esto
 * produce exactamente lo que hay que enviar al servidor.
 */
export function diffTasks(
  previous: readonly Task[],
  next: readonly Task[],
): TaskDiff {
  const previousById = new Map(previous.map((task) => [task.id, task]))
  const nextById = new Map(next.map((task) => [task.id, task]))

  return {
    upserts: next.filter((task) => previousById.get(task.id) !== task),
    deletedIds: previous
      .filter((task) => !nextById.has(task.id))
      .map((task) => task.id),
  }
}

export interface MergeResult {
  tasks: Task[]
  versions: Map<string, string>
  changed: boolean
}

/**
 * Aplica cambios remotos respetando la última escritura ganadora.
 *
 * - Las tareas con una escritura local todavía pendiente se ignoran: la
 *   respuesta de esa escritura será la que fije el estado final.
 * - Una versión remota solo sustituye a otra estrictamente más antigua.
 * - Las lápidas eliminan la tarea y dejan constancia de su versión para que un
 *   evento repetido no la resucite.
 */
export function mergeTaskChanges(
  tasks: readonly Task[],
  versions: ReadonlyMap<string, string>,
  changes: readonly TaskChange[],
  pendingIds: ReadonlySet<string>,
): MergeResult {
  let nextTasks: Task[] | null = null
  let nextVersions: Map<string, string> | null = null
  let changed = false

  const getTasks = (): Task[] => {
    if (!nextTasks) nextTasks = [...tasks]
    return nextTasks
  }

  const getVersions = (): Map<string, string> => {
    if (!nextVersions) nextVersions = new Map(versions)
    return nextVersions
  }

  for (const change of changes) {
    const id = change.task.id
    if (pendingIds.has(id)) continue

    const knownVersion = getVersions().get(id)
    if (knownVersion && change.updatedAt <= knownVersion) continue

    getVersions().set(id, change.updatedAt)

    if (change.deleted) {
      const currentIndex = getTasks().findIndex((task) => task.id === id)
      if (currentIndex !== -1) {
        getTasks().splice(currentIndex, 1)
        changed = true
      }
      continue
    }

    const currentIndex = getTasks().findIndex((task) => task.id === id)
    if (currentIndex === -1) {
      getTasks().push(change.task)
    } else {
      getTasks()[currentIndex] = change.task
    }
    changed = true
  }

  return {
    tasks: changed ? getTasks() : [...tasks],
    versions: nextVersions ?? new Map(versions),
    changed,
  }
}
