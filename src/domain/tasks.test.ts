import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import {
  changeTaskStatus,
  createNextRecurringTask,
  createSubtask,
  createTask,
  getReminderDueAt,
  isReminderDue,
  isTaskOverdue,
  markRecurrenceGenerated,
  nextTaskOrder,
  normalizeSubtasks,
  sortTasks,
  toggleSubtask,
  updateTask,
  validateTaskDraft,
} from './tasks'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Tarea de prueba',
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

describe('tareas', () => {
  const now = new Date(2026, 10, 9, 10, 0, 0)

  it('crea una tarea con valores por defecto y campos normalizados', () => {
    const task = createTask(
      {
        title: '  Comprar pan  ',
        description: '  Integral  ',
        project: '  Casa  ',
      },
      now,
      7,
    )

    expect(task.title).toBe('Comprar pan')
    expect(task.description).toBe('Integral')
    expect(task.project).toBe('Casa')
    expect(task.status).toBe('pending')
    expect(task.priority).toBe('medium')
    expect(task.assignedDate).toBe('2026-11-09')
    expect(task.time).toBeNull()
    expect(task.completedAt).toBeNull()
    expect(task.order).toBe(7)
    expect(task.createdAt).toBe(now.toISOString())
    expect(task.id).toBeTruthy()
    expect(task.fixedDaily).toBe(false)
  })

  it('crea una tarea fija diaria y la sitúa como mínimo en hoy', () => {
    const task = createTask(
      {
        title: 'Rutina diaria',
        assignedDate: '2026-11-01',
        recurrence: { frequency: 'weekly', interval: 2 },
        fixedDaily: true,
      },
      now,
    )

    expect(task.fixedDaily).toBe(true)
    expect(task.recurrence).toEqual({ frequency: 'daily', interval: 1 })
    expect(task.assignedDate).toBe('2026-11-09')
  })

  it('permite quitar la condición de tarea fija al editar', () => {
    const task = makeTask({
      fixedDaily: true,
      recurrence: { frequency: 'daily', interval: 1 },
    })
    const edited = updateTask(
      task,
      { title: task.title, fixedDaily: false, recurrence: null },
      now,
    )

    expect(edited.fixedDaily).toBe(false)
    expect(edited.recurrence).toBeNull()
  })

  it('respeta la ausencia de fecha y hora', () => {
    const task = createTask(
      {
        title: 'Sin día',
        assignedDate: null,
        time: null,
      },
      now,
    )

    expect(task.assignedDate).toBeNull()
    expect(task.time).toBeNull()
  })

  it('rechaza títulos vacíos, demasiado largos y fechas u horas inválidas', () => {
    expect(validateTaskDraft({ title: '   ' }).title).toBeDefined()
    expect(
      validateTaskDraft({ title: 'a'.repeat(121) }).title,
    ).toBeDefined()
    expect(
      validateTaskDraft({
        title: 'Válida',
        assignedDate: '2026-02-30',
      }).assignedDate,
    ).toBeDefined()
    expect(
      validateTaskDraft({ title: 'Válida', time: '25:00' }).time,
    ).toBeDefined()
    expect(
      validateTaskDraft({ title: 'Válida', time: '9:30' }).time,
    ).toBeDefined()

    expect(() => createTask({ title: '   ' }, now)).toThrow()
  })

  it('guarda la finalización al completar y la conserva al editar', () => {
    const task = makeTask()
    const completedAt = new Date(2026, 10, 9, 12, 30, 0)
    const completed = updateTask(
      task,
      { title: task.title, status: 'done' },
      completedAt,
    )

    expect(completed.status).toBe('done')
    expect(completed.completedAt).toBe(completedAt.toISOString())

    const editedLater = updateTask(
      completed,
      { title: 'Título actualizado' },
      new Date(2026, 10, 9, 18, 0, 0),
    )

    expect(editedLater.completedAt).toBe(completed.completedAt)
  })

  it('limpia la finalización al reabrir una tarea', () => {
    const completed = makeTask({
      status: 'done',
      completedAt: '2026-11-09T10:00:00.000Z',
    })
    const reopened = changeTaskStatus(
      completed,
      'in_progress',
      new Date(2026, 10, 9, 11, 0, 0),
    )

    expect(reopened.status).toBe('in_progress')
    expect(reopened.completedAt).toBeNull()
  })

  it('marca como completada una tarea creada directamente como hecha', () => {
    const task = createTask(
      { title: 'Ya hecha', status: 'done' },
      now,
    )

    expect(task.completedAt).toBe(now.toISOString())
  })

  it('identifica tareas atrasadas y excluye las completadas y sin fecha', () => {
    expect(
      isTaskOverdue(
        makeTask({ assignedDate: '2026-11-08' }),
        '2026-11-09',
      ),
    ).toBe(true)
    expect(
      isTaskOverdue(
        makeTask({
          assignedDate: '2026-11-08',
          status: 'done',
        }),
        '2026-11-09',
      ),
    ).toBe(false)
    expect(
      isTaskOverdue(
        makeTask({ assignedDate: '2026-11-09' }),
        '2026-11-09',
      ),
    ).toBe(false)
    expect(
      isTaskOverdue(makeTask({ assignedDate: null }), '2026-11-09'),
    ).toBe(false)
  })

  it('ordena por hora y después por prioridad', () => {
    const laterLow = makeTask({
      id: 'later-low',
      time: '12:00',
      priority: 'low',
      order: 0,
    })
    const earlyLow = makeTask({
      id: 'early-low',
      time: '09:00',
      priority: 'low',
      order: 1,
    })
    const earlyHigh = makeTask({
      id: 'early-high',
      time: '09:00',
      priority: 'high',
      order: 2,
    })
    const noTimeHigh = makeTask({
      id: 'no-time-high',
      time: null,
      priority: 'high',
      order: 3,
    })

    expect(
      sortTasks([laterLow, noTimeHigh, earlyLow, earlyHigh]).map(
        (task) => task.id,
      ),
    ).toEqual(['early-high', 'early-low', 'later-low', 'no-time-high'])
  })

  it('usa el orden manual y la creación como desempate estable', () => {
    const second = makeTask({
      id: 'second',
      time: '10:00',
      priority: 'medium',
      order: 2,
    })
    const first = makeTask({
      id: 'first',
      time: '10:00',
      priority: 'medium',
      order: 1,
    })

    expect(sortTasks([second, first]).map((task) => task.id)).toEqual([
      'first',
      'second',
    ])
  })

  it('calcula el siguiente orden disponible', () => {
    expect(nextTaskOrder([])).toBe(0)
    expect(
      nextTaskOrder([
        makeTask({ id: 'a', order: 2 }),
        makeTask({ id: 'b', order: 7 }),
      ]),
    ).toBe(8)
  })

  it('normaliza subtareas: recorta, descarta vacías y evita ids repetidos', () => {
    const subtasks = normalizeSubtasks([
      createSubtask('  Comprar pan  '),
      createSubtask('   '),
      { id: 'repetido', title: 'Primera', done: true },
      { id: 'repetido', title: 'Segunda', done: false },
    ])

    expect(subtasks).toHaveLength(3)
    expect(subtasks[0].title).toBe('Comprar pan')
    expect(subtasks[0].done).toBe(false)
    expect(subtasks[1].done).toBe(true)
    expect(new Set(subtasks.map((subtask) => subtask.id)).size).toBe(3)
  })

  it('marca todas las subtareas al completar la tarea sin desmarcarlas al reabrir', () => {
    const task = makeTask({
      subtasks: [
        createSubtask('Uno'),
        createSubtask('Dos', true),
      ],
    })
    const completed = changeTaskStatus(
      task,
      'done',
      new Date(2026, 10, 9, 12, 0, 0),
    )

    expect(completed.subtasks.every((subtask) => subtask.done)).toBe(true)

    const reopened = changeTaskStatus(
      completed,
      'pending',
      new Date(2026, 10, 9, 13, 0, 0),
    )

    expect(reopened.subtasks.every((subtask) => subtask.done)).toBe(true)
  })

  it('alterna una subtarea concreta sin tocar las demás', () => {
    const task = makeTask({
      subtasks: [
        createSubtask('Uno', false, 'a'),
        createSubtask('Dos', false, 'b'),
      ],
    })
    const toggled = toggleSubtask(task, 'b')

    expect(toggled.subtasks.find((subtask) => subtask.id === 'a')?.done).toBe(
      false,
    )
    expect(toggled.subtasks.find((subtask) => subtask.id === 'b')?.done).toBe(
      true,
    )
  })

  it('crea la siguiente aparición de una tarea recurrente', () => {
    const task = makeTask({
      status: 'done',
      completedAt: '2026-11-09T10:00:00.000Z',
      subtasks: [createSubtask('Paso hecho', true)],
      recurrence: { frequency: 'daily', interval: 1 },
      fixedDaily: true,
      reminderMinutes: 30,
      time: '10:00',
      reminderNotifiedAt: '2026-11-09T09:30:00.000Z',
    })
    const next = createNextRecurringTask(
      task,
      '2026-11-09',
      new Date(2026, 10, 9, 10, 5, 0),
      4,
    )

    expect(next).not.toBeNull()
    expect(next?.id).not.toBe(task.id)
    expect(next?.status).toBe('pending')
    expect(next?.completedAt).toBeNull()
    expect(next?.assignedDate).toBe('2026-11-10')
    expect(next?.order).toBe(4)
    expect(next?.fixedDaily).toBe(true)
    expect(next?.recurrenceGenerated).toBe(false)
    expect(next?.reminderNotifiedAt).toBeNull()
    expect(next?.reminderMinutes).toBe(30)
    expect(next?.subtasks).toHaveLength(1)
    expect(next?.subtasks[0].done).toBe(false)
    expect(next?.subtasks[0].id).not.toBe(task.subtasks[0].id)
  })

  it('no duplica la siguiente aparición si ya se generó o no hay regla', () => {
    const plain = makeTask()
    expect(
      createNextRecurringTask(plain, '2026-11-09', now),
    ).toBeNull()

    const generated = makeTask({
      recurrence: { frequency: 'daily', interval: 1 },
      recurrenceGenerated: true,
    })
    expect(
      createNextRecurringTask(generated, '2026-11-09', now),
    ).toBeNull()

    const marked = markRecurrenceGenerated(generated)
    expect(marked.recurrenceGenerated).toBe(true)
  })

  it('calcula el instante del recordatorio y aplica el margen de aviso', () => {
    const task = makeTask({
      assignedDate: '2026-11-09',
      time: '10:00',
      reminderMinutes: 30,
    })
    const dueAt = getReminderDueAt(task)

    expect(dueAt).not.toBeNull()
    expect(dueAt?.getHours()).toBe(9)
    expect(dueAt?.getMinutes()).toBe(30)

    expect(isReminderDue(task, new Date(2026, 10, 9, 9, 20, 0))).toBe(false)
    expect(isReminderDue(task, new Date(2026, 10, 9, 9, 45, 0))).toBe(true)
    expect(isReminderDue(task, new Date(2026, 10, 9, 17, 0, 0))).toBe(false)

    expect(
      isReminderDue(
        makeTask({
          ...task,
          reminderNotifiedAt: '2026-11-09T09:30:00.000Z',
        }),
        new Date(2026, 10, 9, 9, 45, 0),
      ),
    ).toBe(false)
    expect(
      isReminderDue(
        makeTask({ ...task, status: 'done' }),
        new Date(2026, 10, 9, 9, 45, 0),
      ),
    ).toBe(false)
  })

  it('valida que el recordatorio necesita una hora y una regla válida', () => {
    expect(
      validateTaskDraft({
        title: 'Aviso',
        reminderMinutes: 30,
        time: null,
      }).reminder,
    ).toBe('Añade una hora para activar el recordatorio.')

    expect(
      validateTaskDraft({
        title: 'Aviso',
        reminderMinutes: 30,
        time: '10:00',
      }).reminder,
    ).toBeUndefined()

    expect(
      validateTaskDraft({
        title: 'Aviso',
        recurrence: { frequency: 'weekly', interval: 0 },
      }).assignedDate,
    ).toBe('La repetición no es válida.')
  })

  it('elimina el recordatorio al quitar la hora y lo conserva al editar otros campos', () => {
    const task = makeTask({
      time: '10:00',
      reminderMinutes: 30,
      reminderNotifiedAt: '2026-11-09T09:30:00.000Z',
    })
    const sameSchedule = updateTask(task, { title: 'Nuevo título' }, now)

    expect(sameSchedule.reminderMinutes).toBe(30)
    expect(sameSchedule.reminderNotifiedAt).toBe(
      '2026-11-09T09:30:00.000Z',
    )

    const withoutTime = updateTask(task, { title: task.title, time: null }, now)
    expect(withoutTime.reminderMinutes).toBeNull()

    const rescheduled = updateTask(
      task,
      { title: task.title, time: '11:00' },
      now,
    )
    expect(rescheduled.reminderNotifiedAt).toBeNull()
  })
})
