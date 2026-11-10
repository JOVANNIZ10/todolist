import {
  addDays,
  getWeekRange,
  isDateInRange,
} from './dates'
import { isTaskOverdue, sortTasks } from './tasks'
import type {
  NavigationCounts,
  Task,
  TaskFilters,
  TaskSortMode,
  TodayProgress,
  ViewKey,
} from '../types'

export const EMPTY_FILTERS: TaskFilters = {
  status: 'all',
  priority: 'all',
  project: null,
  query: '',
}

export function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.status !== 'all' ||
    filters.priority !== 'all' ||
    filters.project !== null ||
    filters.query.trim() !== ''
  )
}

/** Búsqueda sin distinguir mayúsculas ni tildes, útil en español. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .trim()
}

function taskMatchesQuery(task: Task, query: string): boolean {
  if (!query) return true

  const haystack = normalizeSearchText(
    [
      task.title,
      task.description,
      task.project ?? '',
      ...task.subtasks.map((subtask) => subtask.title),
    ].join(' '),
  )

  return haystack.includes(query)
}

export function getTasksForView(
  tasks: readonly Task[],
  view: ViewKey,
  today: string,
  selectedDate: string | null,
): Task[] {
  switch (view) {
    case 'today':
      return tasks.filter((task) => task.assignedDate === today)

    case 'tomorrow': {
      const tomorrow = addDays(today, 1)
      return tasks.filter((task) => task.assignedDate === tomorrow)
    }

    case 'week': {
      const { start, end } = getWeekRange(today)
      return tasks.filter(
        (task) =>
          task.assignedDate !== null &&
          isDateInRange(task.assignedDate, start, end),
      )
    }

    case 'overdue':
      return tasks.filter((task) => isTaskOverdue(task, today))

    case 'unscheduled':
      return tasks.filter((task) => task.assignedDate === null)

    case 'day':
      return selectedDate
        ? tasks.filter((task) => task.assignedDate === selectedDate)
        : []

    default:
      return []
  }
}

export function filterTasks(
  tasks: readonly Task[],
  filters: TaskFilters,
): Task[] {
  const query = normalizeSearchText(filters.query)

  return tasks.filter((task) => {
    if (filters.status !== 'all' && task.status !== filters.status) {
      return false
    }
    if (filters.priority !== 'all' && task.priority !== filters.priority) {
      return false
    }
    if (filters.project !== null && task.project !== filters.project) {
      return false
    }
    if (!taskMatchesQuery(task, query)) {
      return false
    }
    return true
  })
}

export function filterAndSortTasks(
  tasks: readonly Task[],
  filters: TaskFilters,
  sortMode: TaskSortMode = 'time',
): Task[] {
  return sortTasks(filterTasks(tasks, filters), sortMode)
}

export function getProjectOptions(tasks: readonly Task[]): string[] {
  return Array.from(
    new Set(
      tasks
        .map((task) => task.project)
        .filter((project): project is string => Boolean(project)),
    ),
  ).sort((first, second) =>
    first.localeCompare(second, 'es', { sensitivity: 'base' }),
  )
}

export function getTodayProgress(
  tasks: readonly Task[],
  today: string,
): TodayProgress {
  const todayTasks = tasks.filter((task) => task.assignedDate === today)
  const done = todayTasks.filter((task) => task.status === 'done').length
  const total = todayTasks.length
  const pending = total - done

  return {
    done,
    total,
    pending,
    percentage: total > 0 ? Math.round((done / total) * 100) : 0,
  }
}

/**
 * Los contadores de navegación muestran tareas activas (no hechas), salvo
 * el progreso de Hoy, que se calcula aparte sobre el total del día.
 */
export function getNavigationCounts(
  tasks: readonly Task[],
  today: string,
): NavigationCounts {
  const tomorrow = addDays(today, 1)
  const { start, end } = getWeekRange(today)

  return tasks.reduce<NavigationCounts>(
    (counts, task) => {
      if (task.status !== 'done' && task.assignedDate === today) {
        counts.today += 1
      }
      if (task.status !== 'done' && task.assignedDate === tomorrow) {
        counts.tomorrow += 1
      }
      if (
        task.status !== 'done' &&
        task.assignedDate !== null &&
        isDateInRange(task.assignedDate, start, end)
      ) {
        counts.week += 1
      }
      if (isTaskOverdue(task, today)) {
        counts.overdue += 1
      }
      if (task.status !== 'done' && task.assignedDate === null) {
        counts.unscheduled += 1
      }

      return counts
    },
    {
      today: 0,
      tomorrow: 0,
      week: 0,
      overdue: 0,
      unscheduled: 0,
    },
  )
}
