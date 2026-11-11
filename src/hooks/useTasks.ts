import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  deleteRemoteTask,
  fetchTaskChanges,
  isAuthError,
  isNetworkError,
  putTasks,
  taskEventsUrl,
} from '../data/apiClient'
import { loadTasks, saveTasks } from '../data/taskRepository'
import { readCachedTasks, saveCachedTasks } from '../data/remoteCache'
import { diffTasks, mergeTaskChanges } from '../data/taskSync'
import { todayKey } from '../domain/dates'
import { rollFixedDailyTasks } from '../domain/fixedDaily'
import {
  changeTaskStatus,
  createNextRecurringTask,
  createTask as buildTask,
  markRecurrenceGenerated,
  nextTaskOrder,
  toggleSubtask as toggleSubtaskInTask,
  updateTask as applyTaskChanges,
} from '../domain/tasks'
import type {
  SyncStatus,
  Task,
  TaskChange,
  TaskDraft,
  TaskStatus,
} from '../types'

const POLL_INTERVAL_MS = 20_000
const OUTBOX_RETRY_MS = 5_000
const EPOCH = '1970-01-01T00:00:00.000Z'

/** Un fallo de red es falta de conexión, aunque el navegador diga que está en línea. */
function isOfflineFailure(error: unknown): boolean {
  return (
    isNetworkError(error) ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  )
}

export interface UseTasksOptions {
  mode: 'local' | 'remote'
  listId: string | null
  /** Día local actual, para mantener al día las tareas fijas. */
  today: string
  enabled?: boolean
  onAuthExpired?: () => void
}

export interface UseTasksResult {
  tasks: Task[]
  loadWarning: string | null
  storageError: string | null
  syncStatus: SyncStatus
  syncError: string | null
  dismissLoadWarning: () => void
  createTask: (draft: TaskDraft) => Task
  updateTask: (id: string, draft: TaskDraft) => void
  deleteTask: (id: string) => void
  setTaskStatus: (id: string, status: TaskStatus) => void
  toggleTaskDone: (id: string) => void
  toggleSubtask: (taskId: string, subtaskId: string) => void
  moveTaskToToday: (id: string) => void
  moveTasksToToday: (ids: readonly string[]) => void
  reorderTasks: (orderedIds: readonly string[]) => void
  markRemindersNotified: (ids: readonly string[]) => void
  importTasks: (importedTasks: readonly Task[]) => void
  retrySync: () => void
}

interface UpsertEntry {
  kind: 'upsert'
  task: Task
  generation: number
}

interface DeleteEntry {
  kind: 'delete'
  generation: number
}

type OutboxEntry = UpsertEntry | DeleteEntry

interface StreamPayload {
  changes?: TaskChange[]
  serverTime?: string
}

function laterTimestamp(first: string, second: string): string {
  return second > first ? second : first
}

function messageFrom(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'No se ha podido sincronizar con el servidor.'
}

function parseStreamPayload(data: string): StreamPayload | null {
  try {
    const parsed: unknown = JSON.parse(data)
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as StreamPayload
  } catch {
    return null
  }
}

/**
 * Aplica un cambio de estado y, si la tarea pasa a "hecha" y es recurrente,
 * añade la siguiente aparición. La marca `recurrenceGenerated` evita duplicarla
 * si el usuario reabre y vuelve a completar la misma tarea.
 */
function applyStatusChange(
  tasks: readonly Task[],
  taskId: string,
  change: (task: Task) => Task,
  now: Date,
): Task[] {
  const index = tasks.findIndex((task) => task.id === taskId)
  if (index === -1) return [...tasks]

  const original = tasks[index]
  let updated = change(original)
  const nextTasks = [...tasks]
  nextTasks[index] = updated

  if (original.status !== 'done' && updated.status === 'done') {
    const occurrence = createNextRecurringTask(
      updated,
      todayKey(now),
      now,
      nextTaskOrder(tasks),
    )

    if (occurrence) {
      updated = markRecurrenceGenerated(updated)
      nextTasks[index] = updated
      nextTasks.push(occurrence)
    }
  }

  return nextTasks
}

/**
 * Estado de tareas con dos modos:
 *
 * - `local`: localStorage, exactamente como en las fases anteriores.
 * - `remote`: lista de una cuenta, con actualización optimista, cola de
 *   escrituras, SSE en vivo y sondeo periódico como respaldo.
 *
 * Las tareas remotas nunca se escriben en localStorage para no mezclar los
 * datos de varias cuentas en el mismo navegador.
 */
export function useTasks(options: UseTasksOptions): UseTasksResult {
  const { mode, listId, today, enabled = true, onAuthExpired } = options

  const [initialLoad] = useState(loadTasks)
  const [tasks, setTasks] = useState<Task[]>(initialLoad.tasks)
  const [loadWarning, setLoadWarning] = useState<string | null>(
    initialLoad.warning,
  )
  const [storageError, setStorageError] = useState<string | null>(null)
  const [persistAllowed, setPersistAllowed] = useState(
    initialLoad.persistAllowed,
  )
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    mode === 'remote' ? 'connecting' : 'local',
  )
  const [syncError, setSyncError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  /** Lista cuya instantánea ya se ha cargado (o intentado) en modo remoto. */
  const [readyListId, setReadyListId] = useState<string | null>(null)

  const tasksRef = useRef(tasks)
  const modeRef = useRef(mode)
  const listIdRef = useRef(listId)
  const onAuthExpiredRef = useRef(onAuthExpired)

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    listIdRef.current = listId
  }, [listId])

  useEffect(() => {
    onAuthExpiredRef.current = onAuthExpired
  }, [onAuthExpired])

  /** Indica si el estado actual de tareas procede de localStorage o del API. */
  const originRef = useRef<'local' | 'remote'>('local')
  const versionsRef = useRef<Map<string, string>>(new Map())
  const cursorRef = useRef<string>(EPOCH)
  const outboxRef = useRef<Map<string, OutboxEntry>>(new Map())
  const generationRef = useRef(0)
  const eventSourceRef = useRef<EventSource | null>(null)
  const sseOpenRef = useRef(false)
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const retryTimerRef = useRef<number | null>(null)
  const flushInFlightRef = useRef(false)
  const refreshingRef = useRef(false)
  const authExpiredRef = useRef(false)
  const flushRef = useRef<() => void>(() => undefined)

  const applyTasks = useCallback((next: Task[]) => {
    tasksRef.current = next
    setTasks(next)
  }, [])

  const notifyAuthExpired = useCallback(() => {
    if (authExpiredRef.current) return
    authExpiredRef.current = true
    setSyncStatus('error')
    setSyncError('Tu sesión ha caducado. Inicia sesión de nuevo.')
    onAuthExpiredRef.current?.()
  }, [])

  const mergeIncoming = useCallback((changes: TaskChange[]) => {
    if (changes.length === 0) return

    const pending = new Set(outboxRef.current.keys())
    const result = mergeTaskChanges(
      tasksRef.current,
      versionsRef.current,
      changes,
      pending,
    )
    versionsRef.current = result.versions
    if (result.changed) {
      originRef.current = 'remote'
      applyTasks(result.tasks)
      const targetListId = listIdRef.current
      if (targetListId) saveCachedTasks(targetListId, result.tasks)
    }
  }, [applyTasks])

  const closeStream = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    const source = eventSourceRef.current
    if (source) {
      source.close()
      eventSourceRef.current = null
    }
    sseOpenRef.current = false
  }, [])

  const connectStreamRef = useRef<(targetListId: string) => void>(
    () => undefined,
  )

  const connectStream = useCallback(
    (targetListId: string) => {
      closeStream()
      if (typeof EventSource === 'undefined') return

      const source = new EventSource(
        taskEventsUrl(targetListId, cursorRef.current),
      )
      eventSourceRef.current = source

      const scheduleReconnect = () => {
        if (reconnectTimerRef.current !== null) return

        const attempt = reconnectAttemptRef.current
        const wait = Math.min(30_000, 2_000 * 2 ** attempt)
        reconnectAttemptRef.current += 1
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null
          if (
            modeRef.current === 'remote' &&
            listIdRef.current === targetListId
          ) {
            connectStreamRef.current(targetListId)
          }
        }, wait)
      }

      source.onopen = () => {
        sseOpenRef.current = true
        reconnectAttemptRef.current = 0
        setSyncError(null)
        if (outboxRef.current.size === 0) setSyncStatus('synced')
      }

      source.addEventListener('sync', (event) => {
        if (
          modeRef.current !== 'remote' ||
          listIdRef.current !== targetListId
        ) {
          return
        }

        const payload = parseStreamPayload(
          (event as MessageEvent<string>).data,
        )
        if (!payload) return

        if (Array.isArray(payload.changes)) {
          mergeIncoming(payload.changes)
        }
        if (typeof payload.serverTime === 'string') {
          cursorRef.current = laterTimestamp(
            cursorRef.current,
            payload.serverTime,
          )
        }

        setSyncError(null)
        setSyncStatus(
          outboxRef.current.size > 0 ? 'syncing' : 'synced',
        )
      })

      source.onerror = () => {
        source.close()
        if (eventSourceRef.current !== source) return

        eventSourceRef.current = null
        sseOpenRef.current = false
        if (
          modeRef.current !== 'remote' ||
          listIdRef.current !== targetListId
        ) {
          return
        }

        if (outboxRef.current.size === 0) setSyncStatus('offline')
        scheduleReconnect()
      }
    },
    [closeStream, mergeIncoming],
  )

  useEffect(() => {
    connectStreamRef.current = connectStream
  }, [connectStream])

  const refreshChanges = useCallback(
    async (targetListId: string) => {
      if (
        modeRef.current !== 'remote' ||
        listIdRef.current !== targetListId ||
        refreshingRef.current
      ) {
        return
      }

      refreshingRef.current = true
      try {
        const payload = await fetchTaskChanges(
          targetListId,
          cursorRef.current,
        )
        if (
          modeRef.current !== 'remote' ||
          listIdRef.current !== targetListId
        ) {
          return
        }

        mergeIncoming(payload.changes)
        cursorRef.current = laterTimestamp(
          cursorRef.current,
          payload.serverTime,
        )
        setSyncError(null)
        if (outboxRef.current.size === 0) setSyncStatus('synced')
      } catch (error) {
        if (isAuthError(error)) {
          notifyAuthExpired()
          return
        }
        if (!sseOpenRef.current) {
          setSyncStatus('offline')
          setSyncError(
            'No se ha podido conectar con el servidor. Los cambios se guardarán y se reintentará la sincronización.',
          )
        }
      } finally {
        refreshingRef.current = false
      }
    },
    [mergeIncoming, notifyAuthExpired],
  )

  const scheduleFlushRetry = useCallback(() => {
    if (retryTimerRef.current !== null) return
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null
      flushRef.current()
    }, OUTBOX_RETRY_MS)
  }, [])

  const flushOutbox = useCallback(async () => {
    if (flushInFlightRef.current) return
    if (modeRef.current !== 'remote') return

    const targetListId = listIdRef.current
    if (!targetListId) return

    flushInFlightRef.current = true
    let failed = false

    try {
      while (
        modeRef.current === 'remote' &&
        listIdRef.current === targetListId
      ) {
        const entries = Array.from(outboxRef.current.entries())
        if (entries.length === 0) break

        const upserts: Array<[string, UpsertEntry]> = []
        const deletions: Array<[string, DeleteEntry]> = []
        for (const [id, entry] of entries) {
          if (entry.kind === 'upsert') upserts.push([id, entry])
          else deletions.push([id, entry])
        }

        setSyncStatus('syncing')
        let batchRejected = false

        try {
          let responseChanges: TaskChange[] = []

          if (upserts.length > 0) {
            const result = await putTasks(
              targetListId,
              upserts.map(([, entry]) => entry.task),
            )
            responseChanges = result.changes

            if (result.rejected.length > 0) {
              batchRejected = true
              setSyncError(
                `Algunas tareas no se han podido sincronizar: ${
                  result.rejected[0]?.error ?? 'datos no válidos.'
                }`,
              )
              for (const rejected of result.rejected) {
                if (rejected.id) outboxRef.current.delete(rejected.id)
              }
            }
          }

          for (const [id, entry] of upserts) {
            const current = outboxRef.current.get(id)
            if (current?.generation === entry.generation) {
              outboxRef.current.delete(id)
            }
          }

          for (const [id, entry] of deletions) {
            try {
              const result = await deleteRemoteTask(targetListId, id)
              versionsRef.current.set(id, result.change.updatedAt)
            } catch (error) {
              // Otra persona ya la había eliminado: el objetivo está cumplido.
              if (!(error instanceof ApiError && error.status === 404)) {
                throw error
              }
            }

            const current = outboxRef.current.get(id)
            if (current?.generation === entry.generation) {
              outboxRef.current.delete(id)
            }
          }

          mergeIncoming(responseChanges)

          if (outboxRef.current.size === 0) {
            if (!batchRejected) setSyncError(null)
            setSyncStatus('synced')
            break
          }
          if (!batchRejected) setSyncError(null)
        } catch (error) {
          failed = true
          if (isAuthError(error)) {
            notifyAuthExpired()
          } else {
            setSyncError(
              `No se han podido guardar los cambios: ${messageFrom(error)}`,
            )
            setSyncStatus(isOfflineFailure(error) ? 'offline' : 'error')
            scheduleFlushRetry()
          }
          break
        }
      }
    } finally {
      flushInFlightRef.current = false
      if (
        !failed &&
        outboxRef.current.size === 0 &&
        listIdRef.current === targetListId
      ) {
        saveCachedTasks(targetListId, tasksRef.current)
      }
      if (!failed && outboxRef.current.size > 0) {
        flushRef.current()
      }
    }
  }, [
    mergeIncoming,
    notifyAuthExpired,
    scheduleFlushRetry,
  ])

  useEffect(() => {
    flushRef.current = () => {
      void flushOutbox()
    }
  }, [flushOutbox])

  const retrySync = useCallback(() => {
    if (modeRef.current !== 'remote') return

    authExpiredRef.current = false
    setSyncError(null)
    const targetListId = listIdRef.current

    if (!targetListId) {
      setReloadKey((current) => current + 1)
      return
    }

    void flushOutbox()
    void refreshChanges(targetListId)
    if (!eventSourceRef.current) connectStream(targetListId)
  }, [connectStream, flushOutbox, refreshChanges])

  const mutate = useCallback(
    (updater: (current: Task[]) => Task[]) => {
      const previous = tasksRef.current
      const next = updater(previous)
      if (next === previous) return

      originRef.current =
        modeRef.current === 'remote' ? 'remote' : 'local'
      applyTasks(next)

      if (modeRef.current !== 'remote' || !listIdRef.current) return

      const diff = diffTasks(previous, next)
      if (diff.upserts.length === 0 && diff.deletedIds.length === 0) {
        return
      }

      for (const task of diff.upserts) {
        generationRef.current += 1
        outboxRef.current.set(task.id, {
          kind: 'upsert',
          task,
          generation: generationRef.current,
        })
      }
      for (const id of diff.deletedIds) {
        generationRef.current += 1
        outboxRef.current.set(id, {
          kind: 'delete',
          generation: generationRef.current,
        })
      }

      setSyncError(null)
      setSyncStatus('syncing')
      void flushOutbox()
    },
    [applyTasks, flushOutbox],
  )

  // -------------------------------------------------------------------------
  // Modo local
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (mode !== 'local') return

    const loaded = loadTasks()
    originRef.current = 'local'
    // oxlint-disable-next-line react/set-state-in-effect -- carga inicial desde localStorage
    applyTasks(loaded.tasks)
    setLoadWarning(loaded.warning)
    setPersistAllowed(loaded.persistAllowed)
    setStorageError(null)
    setSyncStatus('local')
    setSyncError(null)
    versionsRef.current = new Map()
    outboxRef.current.clear()
  }, [mode, applyTasks])

  useEffect(() => {
    if (mode !== 'local' || !persistAllowed) return
    if (originRef.current !== 'local') return

    try {
      saveTasks(tasksRef.current)
    } catch (error) {
      // oxlint-disable-next-line react/set-state-in-effect -- error de escritura en localStorage
      setPersistAllowed(false)
      setStorageError(
        error instanceof Error
          ? error.message
          : 'No se han podido guardar los cambios.',
      )
    }
  }, [tasks, mode, persistAllowed])

  // -------------------------------------------------------------------------
  // Modo remoto: carga inicial, SSE y respaldo por sondeo
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (mode !== 'remote' || !enabled) return

    const controller = new AbortController()
    let cancelled = false

    authExpiredRef.current = false
    closeStream()
    versionsRef.current = new Map()
    cursorRef.current = EPOCH
    outboxRef.current.clear()
    // oxlint-disable-next-line react/set-state-in-effect -- reinicia los avisos de la lista anterior
    setLoadWarning(null)
    setStorageError(null)
    setSyncError(null)
    setReadyListId(null)

    if (!listId) {
      originRef.current = 'remote'
      // oxlint-disable-next-line react/set-state-in-effect -- no hay lista activa
      applyTasks([])
      setSyncStatus('error')
      setSyncError(
        'No tienes ninguna lista. Crea una o únete a la de otra persona.',
      )
      return () => {
        cancelled = true
        controller.abort()
        closeStream()
      }
    }

    // Muestra al instante la última copia guardada mientras llega la
    // instantánea del servidor. Si no hay conexión, esta copia permanece.
    originRef.current = 'remote'
    const cachedTasks = readCachedTasks(listId)
    // oxlint-disable-next-line react/set-state-in-effect -- caché offline de la lista
    applyTasks(cachedTasks ?? [])
    setSyncStatus('connecting')

    const load = async () => {
      try {
        const snapshot = await fetchTaskChanges(
          listId,
          undefined,
          controller.signal,
        )
        if (cancelled) return

        const result = mergeTaskChanges(
          [],
          new Map(),
          snapshot.changes,
          new Set(),
        )
        originRef.current = 'remote'
        tasksRef.current = result.tasks
        versionsRef.current = result.versions
        cursorRef.current = snapshot.serverTime
        setTasks(result.tasks)
        saveCachedTasks(listId, result.tasks)
        setSyncStatus('synced')
        setReadyListId(listId)
        connectStream(listId)
      } catch (error) {
        if (cancelled || controller.signal.aborted) return

        if (isAuthError(error)) {
          notifyAuthExpired()
          return
        }

        setSyncStatus(isOfflineFailure(error) ? 'offline' : 'error')
        setSyncError(
          cachedTasks
            ? 'No se ha podido contactar con el servidor. Se muestra la última copia guardada en este dispositivo.'
            : `No se han podido cargar las tareas: ${messageFrom(error)}`,
        )
        setReadyListId(listId)
      }
    }

    void load()

    return () => {
      cancelled = true
      controller.abort()
      closeStream()
    }
  }, [
    mode,
    enabled,
    listId,
    reloadKey,
    applyTasks,
    closeStream,
    connectStream,
    notifyAuthExpired,
  ])

  /**
   * Las tareas fijas se trasladan a hoy cuando cambia el día. En remoto se
   * espera a tener la instantánea de la lista para no enviar cambios basados en
   * datos de otra lista o en la caché todavía sin confirmar.
   */
  useEffect(() => {
    if (!enabled) return
    if (mode === 'remote' && readyListId !== listId) return

    mutate((currentTasks) => {
      const rolled = rollFixedDailyTasks(currentTasks, today)
      return rolled === currentTasks ? currentTasks : [...rolled]
    })
  }, [enabled, mode, listId, readyListId, today, mutate])

  useEffect(() => {
    if (mode !== 'remote' || !enabled || !listId) return

    const poll = () => {
      void refreshChanges(listId)
    }

    const intervalId = window.setInterval(poll, POLL_INTERVAL_MS)
    const handleFocus = () => poll()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') poll()
    }
    const handleOnline = () => {
      if (!eventSourceRef.current) connectStream(listId)
      poll()
      void flushOutbox()
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [
    mode,
    enabled,
    listId,
    refreshChanges,
    connectStream,
    flushOutbox,
  ])

  useEffect(() => {
    return () => {
      closeStream()
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [closeStream])

  // -------------------------------------------------------------------------
  // Operaciones de tareas
  // -------------------------------------------------------------------------

  const dismissLoadWarning = useCallback(() => {
    setLoadWarning(null)
  }, [])

  const createTask = useCallback(
    (draft: TaskDraft): Task => {
      const now = new Date()
      const today = todayKey(now)
      const task = buildTask(draft, now)

      mutate((currentTasks) => {
        const order = nextTaskOrder(currentTasks)
        const createdTask = { ...task, order }
        const nextTasks = [...currentTasks, createdTask]

        if (createdTask.status === 'done' && createdTask.recurrence) {
          const occurrence = createNextRecurringTask(
            createdTask,
            today,
            now,
            order + 1,
          )
          if (occurrence) {
            nextTasks[nextTasks.length - 1] = markRecurrenceGenerated(
              createdTask,
            )
            nextTasks.push(occurrence)
          }
        }

        return nextTasks
      })

      return task
    },
    [mutate],
  )

  const updateTask = useCallback(
    (id: string, draft: TaskDraft) => {
      const now = new Date()
      mutate((currentTasks) =>
        applyStatusChange(
          currentTasks,
          id,
          (task) => applyTaskChanges(task, draft, now),
          now,
        ),
      )
    },
    [mutate],
  )

  const deleteTask = useCallback(
    (id: string) => {
      mutate((currentTasks) =>
        currentTasks.some((task) => task.id === id)
          ? currentTasks.filter((task) => task.id !== id)
          : currentTasks,
      )
    },
    [mutate],
  )

  const setTaskStatus = useCallback(
    (id: string, status: TaskStatus) => {
      const now = new Date()
      mutate((currentTasks) =>
        applyStatusChange(
          currentTasks,
          id,
          (task) =>
            task.status === status
              ? task
              : changeTaskStatus(task, status, now),
          now,
        ),
      )
    },
    [mutate],
  )

  const toggleTaskDone = useCallback(
    (id: string) => {
      const now = new Date()
      mutate((currentTasks) =>
        applyStatusChange(
          currentTasks,
          id,
          (task) => {
            const nextStatus = task.status === 'done' ? 'pending' : 'done'
            return changeTaskStatus(task, nextStatus, now)
          },
          now,
        ),
      )
    },
    [mutate],
  )

  const toggleSubtask = useCallback(
    (taskId: string, subtaskId: string) => {
      mutate((currentTasks) =>
        currentTasks.map((task) =>
          task.id === taskId
            ? toggleSubtaskInTask(task, subtaskId)
            : task,
        ),
      )
    },
    [mutate],
  )

  const moveTaskToToday = useCallback(
    (id: string) => {
      const today = todayKey()
      mutate((currentTasks) =>
        currentTasks.map((task) =>
          task.id === id ? { ...task, assignedDate: today } : task,
        ),
      )
    },
    [mutate],
  )

  const moveTasksToToday = useCallback(
    (ids: readonly string[]) => {
      if (ids.length === 0) return
      const idsToMove = new Set(ids)
      const today = todayKey()

      mutate((currentTasks) =>
        currentTasks.map((task) =>
          idsToMove.has(task.id) ? { ...task, assignedDate: today } : task,
        ),
      )
    },
    [mutate],
  )

  const reorderTasks = useCallback(
    (orderedIds: readonly string[]) => {
      if (orderedIds.length === 0) return
      const positions = new Map(
        orderedIds.map((id, index) => [id, index] as const),
      )

      mutate((currentTasks) =>
        currentTasks.map((task) => {
          const position = positions.get(task.id)
          return position === undefined || task.order === position
            ? task
            : { ...task, order: position }
        }),
      )
    },
    [mutate],
  )

  const markRemindersNotified = useCallback(
    (ids: readonly string[]) => {
      if (ids.length === 0) return
      const idsToMark = new Set(ids)
      const timestamp = new Date().toISOString()

      mutate((currentTasks) =>
        currentTasks.map((task) =>
          idsToMark.has(task.id) && task.reminderNotifiedAt === null
            ? { ...task, reminderNotifiedAt: timestamp }
            : task,
        ),
      )
    },
    [mutate],
  )

  const importTasks = useCallback(
    (importedTasks: readonly Task[]) => {
      if (importedTasks.length === 0) return

      mutate((currentTasks) => {
        const byId = new Map(currentTasks.map((task) => [task.id, task]))
        let order = nextTaskOrder(currentTasks)

        for (const imported of importedTasks) {
          const existing = byId.get(imported.id)
          byId.set(
            imported.id,
            existing
              ? { ...imported, order: existing.order }
              : { ...imported, order },
          )
          if (!existing) order += 1
        }

        return Array.from(byId.values())
      })
    },
    [mutate],
  )

  return {
    tasks,
    loadWarning,
    storageError,
    syncStatus,
    syncError,
    dismissLoadWarning,
    createTask,
    updateTask,
    deleteTask,
    setTaskStatus,
    toggleTaskDone,
    toggleSubtask,
    moveTaskToToday,
    moveTasksToToday,
    reorderTasks,
    markRemindersNotified,
    importTasks,
    retrySync,
  }
}
