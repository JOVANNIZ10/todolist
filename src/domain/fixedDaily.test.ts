import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { rollFixedDailyTasks } from './fixedDaily'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Rutina diaria',
    description: '',
    status: 'pending',
    priority: 'medium',
    assignedDate: '2026-11-08',
    time: '09:00',
    project: null,
    createdAt: '2026-11-08T08:00:00.000Z',
    completedAt: null,
    order: 0,
    subtasks: [],
    recurrence: { frequency: 'daily', interval: 1 },
    fixedDaily: true,
    reminderMinutes: 10,
    reminderNotifiedAt: '2026-11-08T08:50:00.000Z',
    recurrenceGenerated: false,
    ...overrides,
  }
}

describe('tareas fijas', () => {
  const today = '2026-11-09'

  it('traslada a hoy una tarea fija pendiente de un día anterior', () => {
    const task = makeTask()
    const result = rollFixedDailyTasks([task], today)

    expect(result).toHaveLength(1)
    expect(result[0]).not.toBe(task)
    expect(result[0].assignedDate).toBe(today)
    expect(result[0].reminderNotifiedAt).toBeNull()
    expect(task.assignedDate).toBe('2026-11-08')
  })

  it('traslada también una tarea fija sin fecha', () => {
    const result = rollFixedDailyTasks(
      [makeTask({ assignedDate: null, time: null, reminderNotifiedAt: null })],
      today,
    )

    expect(result[0].assignedDate).toBe(today)
  })

  it('no mueve tareas completadas, futuras, ya movidas o con sucesora generada', () => {
    const tasks = [
      makeTask({ id: 'done', status: 'done' }),
      makeTask({ id: 'future', assignedDate: '2026-11-12' }),
      makeTask({ id: 'today', assignedDate: today }),
      makeTask({ id: 'generated', recurrenceGenerated: true }),
      makeTask({ id: 'normal', fixedDaily: false }),
    ]

    expect(rollFixedDailyTasks(tasks, today)).toBe(tasks)
  })

  it('mueve solo las tareas fijas que lo necesitan', () => {
    const stale = makeTask({ id: 'stale' })
    const current = makeTask({ id: 'current', assignedDate: today })
    const result = rollFixedDailyTasks([stale, current], today)

    expect(result[0].assignedDate).toBe(today)
    expect(result[1]).toBe(current)
    expect(result).toHaveLength(2)
  })
})
