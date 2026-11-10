import {
  addDays,
  getWeekRange,
  isDateInRange,
  todayKey,
} from './dates'
import { isTaskOverdue } from './tasks'
import {
  TASK_PRIORITIES,
  type Task,
  type TaskPriority,
} from '../types'

export interface PriorityBreakdown {
  total: number
  done: number
}

export interface ProjectBreakdown {
  project: string
  total: number
  done: number
  pending: number
}

export interface DailyCompletion {
  date: string
  count: number
}

export interface TaskStatistics {
  total: number
  done: number
  pending: number
  overdue: number
  dueToday: number
  completionRate: number
  completedThisWeek: number
  byPriority: Record<TaskPriority, PriorityBreakdown>
  projects: ProjectBreakdown[]
  last7Days: DailyCompletion[]
}

function completionDateKey(task: Task): string | null {
  if (task.status !== 'done' || !task.completedAt) return null

  const date = new Date(task.completedAt)
  if (Number.isNaN(date.getTime())) return null

  return todayKey(date)
}

export function getTaskStatistics(
  tasks: readonly Task[],
  today: string,
): TaskStatistics {
  const week = getWeekRange(today)
  const byPriority = Object.fromEntries(
    TASK_PRIORITIES.map((priority) => [
      priority,
      { total: 0, done: 0 } satisfies PriorityBreakdown,
    ]),
  ) as Record<TaskPriority, PriorityBreakdown>

  const projectMap = new Map<string, ProjectBreakdown>()
  const completionCounts = new Map<string, number>()
  let done = 0
  let overdue = 0
  let dueToday = 0
  let completedThisWeek = 0

  for (const task of tasks) {
    if (task.status === 'done') {
      done += 1
    } else if (task.assignedDate === today) {
      dueToday += 1
    }

    if (isTaskOverdue(task, today)) {
      overdue += 1
    }

    byPriority[task.priority].total += 1
    if (task.status === 'done') {
      byPriority[task.priority].done += 1
    }

    if (task.project) {
      const current = projectMap.get(task.project) ?? {
        project: task.project,
        total: 0,
        done: 0,
        pending: 0,
      }
      current.total += 1
      if (task.status === 'done') {
        current.done += 1
      } else {
        current.pending += 1
      }
      projectMap.set(task.project, current)
    }

    const completedOn = completionDateKey(task)
    if (completedOn) {
      completionCounts.set(
        completedOn,
        (completionCounts.get(completedOn) ?? 0) + 1,
      )
      if (isDateInRange(completedOn, week.start, week.end)) {
        completedThisWeek += 1
      }
    }
  }

  const last7Days: DailyCompletion[] = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset)
    last7Days.push({
      date,
      count: completionCounts.get(date) ?? 0,
    })
  }

  const total = tasks.length
  const projects = Array.from(projectMap.values()).sort(
    (first, second) =>
      second.pending - first.pending ||
      second.total - first.total ||
      first.project.localeCompare(second.project, 'es', {
        sensitivity: 'base',
      }),
  )

  return {
    total,
    done,
    pending: total - done,
    overdue,
    dueToday,
    completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
    completedThisWeek,
    byPriority,
    projects,
    last7Days,
  }
}
