import { describe, expect, it } from 'vitest'
import { diffTasks, mergeTaskChanges } from './taskSync'
import type { Task, TaskChange } from '../types'

function makeTask(id: string, changes: Partial<Task> = {}): Task {
  return {
    id,
    title: `Tarea ${id}`,
    description: '',
    status: 'pending',
    priority: 'medium',
    assignedDate: '2026-01-10',
    time: null,
    project: null,
    createdAt: '2026-01-01T09:00:00.000Z',
    completedAt: null,
    order: 0,
    subtasks: [],
    recurrence: null,
    reminderMinutes: null,
    reminderNotifiedAt: null,
    recurrenceGenerated: false,
    fixedDaily: false,
    ...changes,
  }
}

function change(
  task: Task,
  updatedAt: string,
  deleted = false,
): TaskChange {
  return { task, updatedAt, deleted }
}

describe('diffTasks', () => {
  it('detecta altas, modificaciones y eliminaciones por identidad', () => {
    const unchanged = makeTask('a')
    const editedBefore = makeTask('b')
    const editedAfter = { ...editedBefore, title: 'Cambiada' }
    const removed = makeTask('c')
    const added = makeTask('d')

    const result = diffTasks(
      [unchanged, editedBefore, removed],
      [unchanged, editedAfter, added],
    )

    expect(result.upserts).toEqual([editedAfter, added])
    expect(result.deletedIds).toEqual(['c'])
  })

  it('no envía nada cuando las referencias no cambian', () => {
    const tasks = [makeTask('a'), makeTask('b')]
    const result = diffTasks(tasks, [...tasks])

    expect(result.upserts).toEqual([])
    expect(result.deletedIds).toEqual([])
  })
})

describe('mergeTaskChanges', () => {
  it('añade tareas nuevas y guarda su versión', () => {
    const task = makeTask('a')
    const result = mergeTaskChanges(
      [],
      new Map(),
      [change(task, '2026-01-01T10:00:00.000Z')],
      new Set(),
    )

    expect(result.changed).toBe(true)
    expect(result.tasks).toEqual([task])
    expect(result.versions.get('a')).toBe('2026-01-01T10:00:00.000Z')
  })

  it('sustituye una tarea solo con una versión estrictamente más nueva', () => {
    const original = makeTask('a')
    const previous = new Map([['a', '2026-01-01T10:00:00.000Z']])
    const newer = { ...original, title: 'Más reciente' }

    const applied = mergeTaskChanges(
      [original],
      previous,
      [change(newer, '2026-01-01T10:00:01.000Z')],
      new Set(),
    )
    expect(applied.changed).toBe(true)
    expect(applied.tasks[0]?.title).toBe('Más reciente')

    const equal = mergeTaskChanges(
      [original],
      previous,
      [change(newer, '2026-01-01T10:00:00.000Z')],
      new Set(),
    )
    expect(equal.changed).toBe(false)
    expect(equal.tasks[0]).toBe(original)

    const older = mergeTaskChanges(
      [original],
      previous,
      [change(newer, '2026-01-01T09:59:59.000Z')],
      new Set(),
    )
    expect(older.changed).toBe(false)
    expect(older.tasks[0]).toBe(original)
  })

  it('ignora tareas con una escritura local pendiente', () => {
    const task = makeTask('a')
    const result = mergeTaskChanges(
      [task],
      new Map(),
      [change({ ...task, title: 'Remota' }, '2026-01-01T10:00:00.000Z')],
      new Set(['a']),
    )

    expect(result.changed).toBe(false)
    expect(result.tasks).toEqual([task])
    expect(result.versions.has('a')).toBe(false)
  })

  it('elimina con lápidas y no resucita la tarea con eventos repetidos', () => {
    const task = makeTask('a')
    const first = mergeTaskChanges(
      [task],
      new Map(),
      [change(task, '2026-01-01T10:00:00.000Z', true)],
      new Set(),
    )

    expect(first.changed).toBe(true)
    expect(first.tasks).toEqual([])
    expect(first.versions.get('a')).toBe('2026-01-01T10:00:00.000Z')

    const repeated = mergeTaskChanges(
      first.tasks,
      first.versions,
      [change(task, '2026-01-01T10:00:00.000Z', true)],
      new Set(),
    )
    expect(repeated.changed).toBe(false)
    expect(repeated.tasks).toEqual([])
  })

  it('aplica varios cambios de la misma tarea en orden de versión', () => {
    const base = makeTask('a')
    const middle = { ...base, title: 'Intermedia' }
    const latest = { ...base, title: 'Definitiva' }

    const result = mergeTaskChanges(
      [],
      new Map(),
      [
        change(latest, '2026-01-01T10:00:02.000Z'),
        change(middle, '2026-01-01T10:00:01.000Z'),
      ],
      new Set(),
    )

    expect(result.tasks[0]?.title).toBe('Definitiva')
    expect(result.versions.get('a')).toBe('2026-01-01T10:00:02.000Z')
  })

  it('registra la versión de una lápida aunque la tarea no estuviera cargada', () => {
    const missing = makeTask('missing')
    const result = mergeTaskChanges(
      [],
      new Map(),
      [change(missing, '2026-01-01T10:00:00.000Z', true)],
      new Set(),
    )

    expect(result.changed).toBe(false)
    expect(result.versions.get('missing')).toBe('2026-01-01T10:00:00.000Z')
  })
})
