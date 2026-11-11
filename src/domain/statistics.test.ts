import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { getTaskStatistics } from './statistics'

function localIso(
  year: number,
  month: number,
  day: number,
  hour = 10,
): string {
  return new Date(year, month - 1, day, hour).toISOString()
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task',
    title: 'Tarea',
    description: '',
    status: 'pending',
    priority: 'medium',
    assignedDate: '2026-11-11',
    time: null,
    project: null,
    createdAt: localIso(2026, 11, 9),
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

const TODAY = '2026-11-11' // miércoles; semana del 9 al 15

describe('estadísticas', () => {
  const tasks = [
    makeTask({
      id: 'done-today',
      status: 'done',
      completedAt: localIso(2026, 11, 11, 9),
      priority: 'high',
      project: 'Casa',
    }),
    makeTask({
      id: 'done-yesterday',
      status: 'done',
      assignedDate: '2026-11-10',
      completedAt: localIso(2026, 11, 10, 18),
      priority: 'low',
      project: 'Casa',
    }),
    makeTask({
      id: 'pending-today',
      priority: 'high',
      project: 'Trabajo',
    }),
    makeTask({
      id: 'overdue',
      assignedDate: '2026-11-09',
      status: 'in_progress',
      priority: 'medium',
    }),
    makeTask({
      id: 'unscheduled',
      assignedDate: null,
      priority: 'low',
    }),
    makeTask({
      id: 'done-last-week',
      status: 'done',
      assignedDate: '2026-11-07',
      completedAt: localIso(2026, 11, 7, 12),
      priority: 'medium',
    }),
  ]

  it('resume el estado global, las atrasadas y lo previsto para hoy', () => {
    const stats = getTaskStatistics(tasks, TODAY)

    expect(stats.total).toBe(6)
    expect(stats.done).toBe(3)
    expect(stats.pending).toBe(3)
    expect(stats.overdue).toBe(1)
    expect(stats.dueToday).toBe(1)
    expect(stats.completionRate).toBe(50)
    expect(stats.completedThisWeek).toBe(2)
  })

  it('cuenta las tareas completadas en los últimos siete días', () => {
    const stats = getTaskStatistics(tasks, TODAY)

    expect(stats.last7Days.map((day) => day.date)).toEqual([
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
    ])
    expect(stats.last7Days.map((day) => day.count)).toEqual([
      0, 0, 1, 0, 0, 1, 1,
    ])
  })

  it('agrupa por prioridad y proyecto', () => {
    const stats = getTaskStatistics(tasks, TODAY)

    expect(stats.byPriority.high).toEqual({ total: 2, done: 1 })
    expect(stats.byPriority.medium).toEqual({ total: 2, done: 1 })
    expect(stats.byPriority.low).toEqual({ total: 2, done: 1 })

    expect(stats.projects).toEqual([
      { project: 'Trabajo', total: 1, done: 0, pending: 1 },
      { project: 'Casa', total: 2, done: 2, pending: 0 },
    ])
  })

  it('devuelve ceros cuando no hay tareas', () => {
    const stats = getTaskStatistics([], TODAY)

    expect(stats.total).toBe(0)
    expect(stats.completionRate).toBe(0)
    expect(stats.last7Days).toHaveLength(7)
    expect(stats.projects).toEqual([])
  })
})
