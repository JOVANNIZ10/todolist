import type { Task } from '../types'

/**
 * Mantiene las tareas fijas en el día actual.
 *
 * Una tarea fija no completada no se queda atrás: si su fecha es anterior a
 * hoy (o no tiene fecha), pasa a hoy. Así la rutina aparece cada día sin
 * acumular copias atrasadas. Las apariciones completadas se conservan como
 * historial y las que ya generaron la siguiente no se mueven, para no duplicar
 * la serie al reabrir una tarea.
 *
 * Devuelve el mismo array cuando no hay nada que cambiar.
 */
export function rollFixedDailyTasks(
  tasks: readonly Task[],
  today: string,
): readonly Task[] {
  let changed = false

  const nextTasks = tasks.map((task) => {
    if (
      !task.fixedDaily ||
      task.status === 'done' ||
      task.recurrenceGenerated ||
      task.assignedDate === today
    ) {
      return task
    }

    if (task.assignedDate !== null && task.assignedDate > today) {
      return task
    }

    changed = true
    return {
      ...task,
      assignedDate: today,
      reminderNotifiedAt: null,
    }
  })

  return changed ? nextTasks : tasks
}
