import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import {
  EMPTY_FILTERS,
  filterAndSortTasks,
  getNavigationCounts,
  getProjectOptions,
  getTasksForView,
  getTodayProgress,
  hasActiveFilters,
} from './selectors'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task',
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
    fixedDaily: false,
    ...overrides,
  }
}

const TODAY = '2026-11-11' // miércoles; semana del 9 al 15

describe('vistas y filtros', () => {
  const tasks = [
    makeTask({ id: 'monday', assignedDate: '2026-11-09' }),
    makeTask({ id: 'today', assignedDate: TODAY, time: '10:00' }),
    makeTask({
      id: 'sunday',
      assignedDate: '2026-11-15',
      project: 'Casa',
    }),
    makeTask({ id: 'previous-week', assignedDate: '2026-11-08' }),
    makeTask({ id: 'next-week', assignedDate: '2026-11-16' }),
    makeTask({
      id: 'done-overdue',
      assignedDate: '2026-11-10',
      status: 'done',
      completedAt: '2026-11-10T18:00:00.000Z',
    }),
    makeTask({ id: 'unscheduled', assignedDate: null }),
  ]

  it('incluye de lunes a domingo en Esta semana', () => {
    expect(
      getTasksForView(tasks, 'week', TODAY, TODAY).map((task) => task.id),
    ).toEqual(['monday', 'today', 'sunday', 'done-overdue'])
  })

  it('separa las tareas atrasadas de las completadas', () => {
    expect(
      getTasksForView(tasks, 'overdue', TODAY, TODAY).map(
        (task) => task.id,
      ),
    ).toEqual(['monday', 'previous-week'])
  })

  it('muestra solo las tareas sin fecha', () => {
    expect(
      getTasksForView(tasks, 'unscheduled', TODAY, TODAY).map(
        (task) => task.id,
      ),
    ).toEqual(['unscheduled'])
  })

  it('filtra por estado, prioridad y proyecto', () => {
    const filtered = filterAndSortTasks(tasks, {
      status: 'pending',
      priority: 'medium',
      project: 'Casa',
      query: '',
    })

    expect(filtered.map((task) => task.id)).toEqual(['sunday'])
  })

  it('permite limpiar los filtros', () => {
    const filtered = filterAndSortTasks(tasks, EMPTY_FILTERS)
    expect(filtered).toHaveLength(tasks.length)
  })

  it('calcula el progreso del día y los contadores de navegación', () => {
    const dayTasks = [
      ...tasks,
      makeTask({
        id: 'done-today',
        assignedDate: TODAY,
        status: 'done',
        completedAt: '2026-11-11T09:00:00.000Z',
      }),
    ]

    expect(getTodayProgress(dayTasks, TODAY)).toEqual({
      done: 1,
      total: 2,
      pending: 1,
      percentage: 50,
    })

    const counts = getNavigationCounts(dayTasks, TODAY)
    expect(counts.today).toBe(1)
    expect(counts.overdue).toBe(2)
    expect(counts.unscheduled).toBe(1)
  })

  it('ordena los proyectos de forma estable y sin duplicados', () => {
    expect(
      getProjectOptions([
        makeTask({ id: 'a', project: 'Trabajo' }),
        makeTask({ id: 'b', project: 'casa' }),
        makeTask({ id: 'c', project: 'Trabajo' }),
        makeTask({ id: 'd', project: null }),
      ]),
    ).toEqual(['casa', 'Trabajo'])
  })

  it('busca sin distinguir mayúsculas ni tildes en todos los campos', () => {
    const searchable = [
      makeTask({ id: 'title', title: 'Llamar a Mamá' }),
      makeTask({
        id: 'description',
        title: 'Recado',
        description: 'Pasar por la farmacia',
      }),
      makeTask({ id: 'project', title: 'Informe', project: 'Trabajo' }),
      makeTask({
        id: 'subtask',
        title: 'Compra',
        subtasks: [
          { id: 's1', title: 'Leche sin lactosa', done: false },
        ],
      }),
      makeTask({ id: 'other', title: 'Paseo' }),
    ]

    const search = (query: string) =>
      filterAndSortTasks(searchable, {
        ...EMPTY_FILTERS,
        query,
      }).map((task) => task.id)

    expect(search('MAMA')).toEqual(['title'])
    expect(search('farmacia')).toEqual(['description'])
    expect(search('trabajo')).toEqual(['project'])
    expect(search('LACTOSA')).toEqual(['subtask'])
    expect(search('   ')).toHaveLength(searchable.length)
  })

  it('considera la búsqueda como un filtro activo', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
    expect(
      hasActiveFilters({ ...EMPTY_FILTERS, query: 'pan' }),
    ).toBe(true)
    expect(
      hasActiveFilters({ ...EMPTY_FILTERS, query: '   ' }),
    ).toBe(false)
  })

  it('respeta el orden manual cuando se solicita', () => {
    const manualTasks = [
      makeTask({ id: 'second', order: 2, time: '09:00' }),
      makeTask({ id: 'first', order: 1, time: '18:00' }),
      makeTask({ id: 'third', order: 3, time: '12:00' }),
    ]

    expect(
      filterAndSortTasks(manualTasks, EMPTY_FILTERS, 'manual').map(
        (task) => task.id,
      ),
    ).toEqual(['first', 'second', 'third'])

    expect(
      filterAndSortTasks(manualTasks, EMPTY_FILTERS, 'time').map(
        (task) => task.id,
      ),
    ).toEqual(['second', 'third', 'first'])
  })
})
