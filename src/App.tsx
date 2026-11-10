import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthScreen } from './components/AuthScreen'
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog'
import { FilterBar } from './components/FilterBar'
import { InstallBanner } from './components/InstallBanner'
import { IconChevronLeft, IconChevronRight, IconPlus } from './components/Icons'
import { ListsDialog } from './components/ListsDialog'
import { OverdueToolbar } from './components/OverdueToolbar'
import { SettingsDialog } from './components/SettingsDialog'
import { Sidebar } from './components/Sidebar'
import { StorageNotice } from './components/StorageNotice'
import { StatisticsDialog } from './components/StatisticsDialog'
import { TaskFormDialog } from './components/TaskFormDialog'
import { TaskList } from './components/TaskList'
import { Toast } from './components/Toast'
import { TodaySummary } from './components/TodaySummary'
import {
  addDays,
  getWeekRange,
  isValidDateKey,
  todayKey,
} from './domain/dates'
import { nextRecurrenceDate } from './domain/recurrence'
import {
  EMPTY_FILTERS,
  filterAndSortTasks,
  getNavigationCounts,
  getProjectOptions,
  getTasksForView,
  getTodayProgress,
  hasActiveFilters,
} from './domain/selectors'
import { getTaskStatistics } from './domain/statistics'
import {
  parseTaskBackup,
  serializeTaskBackup,
} from './data/taskTransfer'
import { loadTasks } from './data/taskRepository'
import {
  migrationFingerprint,
  readMigrationFingerprint,
  saveMigrationFingerprint,
} from './data/syncPreferences'
import type { LoginInput, RegistrationInput } from './data/apiClient'
import { useAuth } from './hooks/useAuth'
import { usePwaInstall } from './hooks/usePwaInstall'
import { useReminders } from './hooks/useReminders'
import { useSettings } from './hooks/useSettings'
import { useTasks } from './hooks/useTasks'
import { useToday } from './hooks/useToday'
import { useToast } from './hooks/useToast'
import {
  formatCompactDate,
  formatFullDate,
  formatWeekRange,
  pluralize,
} from './lib/formatters'
import {
  SORT_MODE_LABELS,
  STATUS_LABELS,
  SYNC_STATUS_LABELS,
} from './lib/labels'
import type {
  MainViewKey,
  Task,
  TaskDraft,
  TaskFilters,
  TaskStatus,
  ViewKey,
} from './types'

interface ViewMetadata {
  eyebrow: string
  title: string
  subtitle: string
}

type NotificationPermissionState = NotificationPermission | 'unsupported'

function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }

  return Notification.permission
}

function getDefaultAssignedDate(
  view: ViewKey,
  today: string,
  selectedDate: string,
): string | null {
  switch (view) {
    case 'tomorrow':
      return addDays(today, 1)
    case 'day':
      return selectedDate
    case 'unscheduled':
      return null
    case 'today':
    case 'week':
    case 'overdue':
    default:
      return today
  }
}

function getNextOccurrenceNotice(
  task: Task,
  draft: TaskDraft,
  today: string,
): string | null {
  const recurrence =
    draft.recurrence === undefined ? task.recurrence : draft.recurrence
  const status = draft.status ?? task.status
  const assignedDate =
    draft.assignedDate === undefined
      ? task.assignedDate
      : draft.assignedDate

  if (
    task.status === 'done' ||
    status !== 'done' ||
    !recurrence ||
    task.recurrenceGenerated
  ) {
    return null
  }

  try {
    return formatCompactDate(
      nextRecurrenceDate(assignedDate ?? today, recurrence, today),
    )
  } catch {
    return null
  }
}

function App() {
  const today = useToday()
  const { settings, resolvedTheme, updateSettings } = useSettings()
  const { toast, showToast, dismissToast } = useToast()
  const pwaInstall = usePwaInstall()
  const installPwa = pwaInstall.install
  const handleInstallPwa = useCallback(async () => {
    const accepted = await installPwa()
    if (accepted) {
      showToast('DíaLista instalada. Ábrela desde su nuevo icono.')
    }
    return accepted
  }, [installPwa, showToast])
  const auth = useAuth()
  const {
    login: authLogin,
    register: authRegister,
    logout: authLogout,
    selectList: authSelectList,
    joinList: authJoinList,
    createList: authCreateList,
    leaveList: authLeaveList,
    dismissError: dismissAuthError,
  } = auth
  const authHandleSessionExpired = auth.handleSessionExpired
  const handleSessionExpired = useCallback(() => {
    authHandleSessionExpired()
    showToast('Tu sesión ha caducado. Inicia sesión de nuevo.', 'error')
  }, [authHandleSessionExpired, showToast])

  const isAuthenticated = auth.status === 'authenticated'
  const {
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
  } = useTasks({
    mode: isAuthenticated ? 'remote' : 'local',
    listId: auth.activeListId,
    enabled: auth.status !== 'loading',
    onAuthExpired: handleSessionExpired,
  })

  const localTasks = useMemo(
    () => (isAuthenticated ? loadTasks().tasks : []),
    [isAuthenticated],
  )
  const localFingerprint = useMemo(
    () => migrationFingerprint(localTasks),
    [localTasks],
  )

  const [view, setView] = useState<ViewKey>('today')
  const [selectedDate, setSelectedDate] = useState(today)
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [selectedOverdueIds, setSelectedOverdueIds] = useState<Set<string>>(
    new Set(),
  )
  const [isStatisticsOpen, setIsStatisticsOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [isListsOpen, setIsListsOpen] = useState(false)
  const [migrationAcknowledged, setMigrationAcknowledged] = useState<
    string | null
  >(null)
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>(getNotificationPermission)

  const viewTasks = useMemo(
    () => getTasksForView(tasks, view, today, selectedDate),
    [tasks, view, today, selectedDate],
  )
  const visibleTasks = useMemo(
    () =>
      filterAndSortTasks(viewTasks, filters, settings.sortMode),
    [viewTasks, filters, settings.sortMode],
  )
  const projects = useMemo(() => getProjectOptions(tasks), [tasks])
  const counts = useMemo(
    () => getNavigationCounts(tasks, today),
    [tasks, today],
  )
  const progress = useMemo(
    () => getTodayProgress(tasks, today),
    [tasks, today],
  )
  const statistics = useMemo(
    () => getTaskStatistics(tasks, today),
    [tasks, today],
  )
  const filtersActive = hasActiveFilters(filters)
  const reorderEnabled =
    settings.sortMode === 'manual' && !filtersActive
  const defaultAssignedDate = getDefaultAssignedDate(
    view,
    today,
    selectedDate,
  )
  const projectFilterOptions = useMemo(() => {
    if (
      filters.project === null ||
      projects.includes(filters.project)
    ) {
      return projects
    }

    return [...projects, filters.project].sort((first, second) =>
      first.localeCompare(second, 'es', { sensitivity: 'base' }),
    )
  }, [projects, filters.project])

  const viewMetadata = useMemo<ViewMetadata>(() => {
    switch (view) {
      case 'today':
        return {
          eyebrow: 'Tu agenda',
          title: 'Hoy',
          subtitle: formatFullDate(today),
        }
      case 'tomorrow':
        return {
          eyebrow: 'Tu agenda',
          title: 'Mañana',
          subtitle: formatFullDate(addDays(today, 1)),
        }
      case 'week': {
        const { start, end } = getWeekRange(today)
        return {
          eyebrow: 'Tu agenda',
          title: 'Esta semana',
          subtitle: `Lunes a domingo · ${formatWeekRange(start, end)}`,
        }
      }
      case 'overdue':
        return {
          eyebrow: 'Pendientes',
          title: 'Atrasadas',
          subtitle:
            'Tareas de días anteriores. Muévelas a hoy cuando las vayas a hacer.',
        }
      case 'unscheduled':
        return {
          eyebrow: 'Pendientes',
          title: 'Sin fecha',
          subtitle: 'Tareas que todavía no tienen un día asignado.',
        }
      case 'day':
        return {
          eyebrow: 'Día seleccionado',
          title: formatFullDate(selectedDate, false),
          subtitle: 'Consulta y organiza las tareas de esta fecha.',
        }
      default:
        return {
          eyebrow: 'Tu agenda',
          title: 'DíaLista',
          subtitle: '',
        }
    }
  }, [view, today, selectedDate])

  useEffect(() => {
    document.title = `${viewMetadata.title} · DíaLista`
  }, [viewMetadata.title])

  const handleRemindersDue = useCallback(
    (dueTasks: Task[]) => {
      const names = dueTasks
        .map((task) => `«${task.title}»`)
        .join(', ')
      const firstTask = dueTasks[0]
      const detail =
        dueTasks.length === 1 && firstTask.time
          ? ` · ${firstTask.time}`
          : ''
      showToast(`Recordatorio: ${names}${detail}`, 'reminder')

      if (
        settings.browserNotifications &&
        notificationPermission === 'granted' &&
        'Notification' in window
      ) {
        for (const task of dueTasks) {
          try {
            new Notification('DíaLista · Recordatorio', {
              body: `${task.title}${task.time ? ` · ${task.time}` : ''}`,
              tag: task.id,
            })
          } catch {
            // Si el navegador bloquea la notificación, el aviso in-app sigue.
          }
        }
      }

      markRemindersNotified(dueTasks.map((task) => task.id))
    },
    [
      markRemindersNotified,
      notificationPermission,
      settings.browserNotifications,
      showToast,
    ],
  )

  useReminders(tasks, handleRemindersDue)

  const handleSelectView = (nextView: MainViewKey) => {
    setView(nextView)
    setSelectedOverdueIds(new Set())
  }

  const handleSelectDate = (date: string) => {
    if (!isValidDateKey(date)) return
    setSelectedDate(date)
    setView('day')
    setSelectedOverdueIds(new Set())
  }

  const shiftSelectedDay = (amount: number) => {
    setSelectedDate((current) => addDays(current, amount))
    setView('day')
  }

  const handleOpenCreate = () => {
    setEditingTask(null)
    setIsFormOpen(true)
  }

  const handleOpenEdit = (task: Task) => {
    setEditingTask(task)
    setIsFormOpen(true)
  }

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false)
    setEditingTask(null)
  }, [])

  const handleSaveTask = (draft: TaskDraft) => {
    if (editingTask) {
      const nextOccurrence = getNextOccurrenceNotice(
        editingTask,
        draft,
        today,
      )
      updateTask(editingTask.id, draft)
      showToast(
        nextOccurrence
          ? `Cambios guardados · Siguiente: ${nextOccurrence}`
          : 'Cambios guardados',
      )
    } else {
      createTask(draft)
      showToast('Tarea creada')
    }

    setSelectedOverdueIds(new Set())
    handleCloseForm()
  }

  const handleStatusChange = (task: Task, nextStatus: TaskStatus) => {
    if (task.status === nextStatus) return

    const nextOccurrence = getNextOccurrenceNotice(
      task,
      { title: task.title, status: nextStatus },
      today,
    )
    setTaskStatus(task.id, nextStatus)
    setSelectedOverdueIds(new Set())

    if (nextStatus === 'done') {
      showToast(
        nextOccurrence
          ? `Tarea completada · Siguiente: ${nextOccurrence}`
          : 'Tarea completada',
      )
    } else if (task.status === 'done') {
      showToast('Tarea reabierta')
    } else {
      showToast(`Estado: ${STATUS_LABELS[nextStatus]}`)
    }
  }

  const handleToggleDone = (task: Task) => {
    const nextStatus: TaskStatus =
      task.status === 'done' ? 'pending' : 'done'
    const nextOccurrence = getNextOccurrenceNotice(
      task,
      { title: task.title, status: nextStatus },
      today,
    )

    toggleTaskDone(task.id)
    setSelectedOverdueIds(new Set())
    showToast(
      task.status === 'done'
        ? 'Tarea reabierta'
        : nextOccurrence
          ? `Tarea completada · Siguiente: ${nextOccurrence}`
          : 'Tarea completada',
    )
  }

  const handleMoveToToday = (task: Task) => {
    moveTaskToToday(task.id)
    setSelectedOverdueIds(new Set())
    showToast('Tarea movida a hoy')
  }

  const handleToggleOverdueSelection = (id: string) => {
    setSelectedOverdueIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAllOverdue = () => {
    setSelectedOverdueIds(
      new Set(visibleTasks.map((task) => task.id)),
    )
  }

  const handleMoveSelectedOverdue = () => {
    const idsToMove = visibleTasks
      .filter((task) => selectedOverdueIds.has(task.id))
      .map((task) => task.id)

    if (idsToMove.length === 0) return

    moveTasksToToday(idsToMove)
    setSelectedOverdueIds(new Set())
    showToast(
      pluralize(
        idsToMove.length,
        'tarea movida a hoy',
        'tareas movidas a hoy',
      ),
    )
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    deleteTask(deleteTarget.id)
    setDeleteTarget(null)
    setSelectedOverdueIds(new Set())
    showToast('Tarea eliminada')
  }

  const handleFiltersChange = (nextFilters: TaskFilters) => {
    setFilters(nextFilters)
    setSelectedOverdueIds(new Set())
  }

  const handleClearFilters = () => {
    setFilters({ ...EMPTY_FILTERS })
    setSelectedOverdueIds(new Set())
  }

  const handleToggleTheme = () => {
    updateSettings({
      theme: resolvedTheme === 'dark' ? 'light' : 'dark',
    })
  }

  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported')
      showToast('Este navegador no permite notificaciones.', 'error')
      return
    }

    try {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)

      if (permission === 'granted') {
        updateSettings({ browserNotifications: true })
        showToast('Notificaciones del navegador activadas')
      } else {
        showToast(
          'No se han concedido las notificaciones. Puedes cambiarlo en los ajustes del navegador.',
          'error',
        )
      }
    } catch {
      showToast('No se han podido activar las notificaciones.', 'error')
    }
  }

  const handleExport = () => {
    try {
      const json = serializeTaskBackup(tasks)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `dialista-${todayKey()}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      showToast('Copia de seguridad exportada')
    } catch {
      showToast('No se ha podido exportar la copia.', 'error')
    }
  }

  const handleImportFile = useCallback(
    async (file: File): Promise<string> => {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('El archivo supera el límite de 5 MB.')
      }

      const raw = await file.text()
      const parsed = parseTaskBackup(raw)
      importTasks(parsed.tasks)
      setSelectedOverdueIds(new Set())

      const skippedNote =
        parsed.skipped > 0
          ? ` Se han omitido ${parsed.skipped} entradas no válidas.`
          : ''
      showToast(
        pluralize(
          parsed.tasks.length,
          'tarea importada',
          'tareas importadas',
        ),
      )

      return `Se han importado ${pluralize(
        parsed.tasks.length,
        'tarea',
        'tareas',
      )}.${skippedNote}`
    },
    [importTasks, showToast],
  )

  const handleOpenAuth = useCallback(() => {
    setIsSettingsOpen(false)
    setIsListsOpen(false)
    setIsAuthOpen(true)
  }, [])

  const handleOpenLists = useCallback(() => {
    setIsSettingsOpen(false)
    setIsAuthOpen(false)
    setIsListsOpen(true)
  }, [])

  const handleLogin = useCallback(
    async (input: LoginInput) => {
      await authLogin(input)
      setIsListsOpen(false)
      showToast('Sesión iniciada')
    },
    [authLogin, showToast],
  )

  const handleRegister = useCallback(
    async (input: RegistrationInput) => {
      await authRegister(input)
      setIsListsOpen(false)
      showToast('Cuenta creada. Ya puedes compartir tu lista.')
    },
    [authRegister, showToast],
  )

  const handleLogout = useCallback(async () => {
    setIsSettingsOpen(false)
    setIsListsOpen(false)
    await authLogout()
    showToast('Sesión cerrada. Estás en modo local.')
  }, [authLogout, showToast])

  const handleSelectList = useCallback(
    (listId: string) => {
      authSelectList(listId)
      setFilters({ ...EMPTY_FILTERS })
      setSelectedOverdueIds(new Set())
    },
    [authSelectList],
  )

  const handleJoinList = useCallback(
    async (code: string) => {
      const list = await authJoinList(code)
      setFilters({ ...EMPTY_FILTERS })
      setSelectedOverdueIds(new Set())
      showToast(`Te has unido a «${list.name}»`)
      return list
    },
    [authJoinList, showToast],
  )

  const handleCreateList = useCallback(
    async (name: string) => {
      const list = await authCreateList(name)
      setFilters({ ...EMPTY_FILTERS })
      setSelectedOverdueIds(new Set())
      showToast(`Lista «${list.name}» creada`)
      return list
    },
    [authCreateList, showToast],
  )

  const handleLeaveList = useCallback(
    async (listId: string) => {
      await authLeaveList(listId)
      setFilters({ ...EMPTY_FILTERS })
      setSelectedOverdueIds(new Set())
      showToast('Has salido de la lista')
    },
    [authLeaveList, showToast],
  )

  const migrationKey =
    auth.activeListId && localFingerprint
      ? `${auth.activeListId}:${localFingerprint}`
      : null

  const acknowledgeMigration = useCallback(() => {
    if (!auth.activeListId || !localFingerprint) return

    saveMigrationFingerprint(auth.activeListId, localFingerprint)
    setMigrationAcknowledged(`${auth.activeListId}:${localFingerprint}`)
  }, [auth.activeListId, localFingerprint])

  const handleMigrateLocal = useCallback(() => {
    if (
      !isAuthenticated ||
      !auth.activeListId ||
      localTasks.length === 0
    ) {
      return
    }

    importTasks(localTasks)
    acknowledgeMigration()
    showToast(
      pluralize(
        localTasks.length,
        'tarea copiada a la lista',
        'tareas copiadas a la lista',
      ),
    )
  }, [
    acknowledgeMigration,
    auth.activeListId,
    importTasks,
    isAuthenticated,
    localTasks,
    showToast,
  ])

  const resultLabel = filtersActive
    ? `${visibleTasks.length} de ${viewTasks.length}`
    : pluralize(visibleTasks.length, 'tarea', 'tareas')

  const savedMigrationFingerprint =
    isAuthenticated && auth.activeListId
      ? readMigrationFingerprint(auth.activeListId)
      : null

  const showMigrationNotice =
    isAuthenticated &&
    localTasks.length > 0 &&
    migrationAcknowledged !== migrationKey &&
    savedMigrationFingerprint !== localFingerprint

  if (auth.status === 'loading') {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        <span className="app-loading__mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="30" height="30" fill="none">
            <path
              d="M9 16.5 14 21 23.5 10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="app-loading__name">DíaLista</p>
        <p className="app-loading__text">Comprobando tu sesión…</p>
        <span className="app-loading__spinner" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        selectedDate={selectedDate}
        counts={counts}
        resolvedTheme={resolvedTheme}
        authenticated={isAuthenticated}
        userName={auth.user?.name ?? null}
        activeListName={auth.activeList?.name ?? null}
        listMemberCount={auth.activeList?.memberCount ?? null}
        syncStatus={syncStatus}
        onSelectView={handleSelectView}
        onSelectDate={handleSelectDate}
        onOpenStatistics={() => setIsStatisticsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleTheme={handleToggleTheme}
        onOpenAccount={handleOpenAuth}
        onOpenLists={handleOpenLists}
      />

      <main className="main">
        <div className="main__inner">
          <InstallBanner
            canInstall={pwaInstall.canInstall}
            installed={pwaInstall.installed}
            isIos={pwaInstall.isIos}
            dismissed={pwaInstall.dismissed}
            onInstall={handleInstallPwa}
            onDismiss={pwaInstall.dismiss}
          />
          {!isAuthenticated && auth.error && (
            <StorageNotice
              message={auth.error}
              action={{
                label: 'Entrar o crear cuenta',
                onClick: handleOpenAuth,
              }}
              onDismiss={auth.dismissError}
            />
          )}
          {isAuthenticated && syncError && (
            <StorageNotice
              tone="error"
              message={syncError}
              action={
                auth.activeListId
                  ? { label: 'Reintentar', onClick: retrySync }
                  : { label: 'Gestionar listas', onClick: handleOpenLists }
              }
            />
          )}
          {showMigrationNotice && (
            <StorageNotice
              message={`Tienes ${pluralize(
                localTasks.length,
                'tarea guardada',
                'tareas guardadas',
              )} en este dispositivo. Puedes copiarlas a «${
                auth.activeList?.name ?? 'tu lista'
              }» para sincronizarlas y compartirlas.`}
              action={{
                label: 'Copiar a esta lista',
                onClick: handleMigrateLocal,
              }}
              onDismiss={acknowledgeMigration}
            />
          )}
          {loadWarning && (
            <StorageNotice
              message={loadWarning}
              onDismiss={dismissLoadWarning}
            />
          )}
          {storageError && (
            <StorageNotice
              tone="error"
              message={storageError}
            />
          )}

          <header className="view-header">
            <div className="view-header__copy">
              <p className="view-eyebrow">{viewMetadata.eyebrow}</p>
              <h1>{viewMetadata.title}</h1>
              <p className="view-subtitle">{viewMetadata.subtitle}</p>
            </div>

            <div className="view-header__actions">
              {isAuthenticated && (
                <button
                  type="button"
                  className={`sync-pill sync-pill--${syncStatus}`}
                  title={`${SYNC_STATUS_LABELS[syncStatus]}. Abrir listas y cuenta.`}
                  onClick={
                    syncStatus === 'error' ? retrySync : handleOpenLists
                  }
                >
                  <span
                    className={`sync-dot sync-dot--${syncStatus}`}
                    aria-hidden="true"
                  />
                  {SYNC_STATUS_LABELS[syncStatus]}
                </button>
              )}

              {view === 'day' && (
                <div className="day-stepper" aria-label="Cambiar de día">
                  <button
                    type="button"
                    className="icon-action icon-action--bordered"
                    aria-label="Día anterior"
                    onClick={() => shiftSelectedDay(-1)}
                  >
                    <IconChevronLeft />
                  </button>
                  <button
                    type="button"
                    className="icon-action icon-action--bordered"
                    aria-label="Día siguiente"
                    onClick={() => shiftSelectedDay(1)}
                  >
                    <IconChevronRight />
                  </button>
                </div>
              )}

              <button
                type="button"
                className="button button--primary"
                onClick={handleOpenCreate}
              >
                <IconPlus />
                Nueva tarea
              </button>
            </div>
          </header>

          {view === 'today' && (
            <TodaySummary
              progress={progress}
              overdueCount={counts.overdue}
              onShowOverdue={() => handleSelectView('overdue')}
            />
          )}

          <section className="workspace" aria-labelledby="tasks-heading">
            <div className="workspace__header">
              <div>
                <p className="section-eyebrow">Organiza</p>
                <h2 id="tasks-heading">Tareas</h2>
              </div>
              <div className="workspace__meta">
                <div
                  className="sort-toggle"
                  role="group"
                  aria-label="Orden de las tareas"
                >
                  <button
                    type="button"
                    className={
                      settings.sortMode === 'time' ? 'is-active' : ''
                    }
                    aria-pressed={settings.sortMode === 'time'}
                    onClick={() =>
                      updateSettings({ sortMode: 'time' })
                    }
                  >
                    {SORT_MODE_LABELS.time}
                  </button>
                  <button
                    type="button"
                    className={
                      settings.sortMode === 'manual' ? 'is-active' : ''
                    }
                    aria-pressed={settings.sortMode === 'manual'}
                    onClick={() =>
                      updateSettings({ sortMode: 'manual' })
                    }
                  >
                    {SORT_MODE_LABELS.manual}
                  </button>
                </div>
                <p className="task-count" aria-live="polite">
                  {resultLabel}
                </p>
              </div>
            </div>

            <FilterBar
              filters={filters}
              projects={projectFilterOptions}
              isActive={filtersActive}
              onChange={handleFiltersChange}
              onClear={handleClearFilters}
            />

            {view === 'overdue' && visibleTasks.length > 0 && (
              <OverdueToolbar
                visibleIds={visibleTasks.map((task) => task.id)}
                selectedIds={selectedOverdueIds}
                onSelectAll={handleSelectAllOverdue}
                onClearSelection={() => setSelectedOverdueIds(new Set())}
                onMoveSelected={handleMoveSelectedOverdue}
              />
            )}

            <TaskList
              tasks={visibleTasks}
              view={view}
              today={today}
              hasFilters={filtersActive}
              sortMode={settings.sortMode}
              reorderEnabled={reorderEnabled}
              selectedIds={selectedOverdueIds}
              onToggleSelected={handleToggleOverdueSelection}
              onEdit={handleOpenEdit}
              onDelete={setDeleteTarget}
              onStatusChange={handleStatusChange}
              onToggleDone={handleToggleDone}
              onMoveToToday={handleMoveToToday}
              onToggleSubtask={toggleSubtask}
              onReorder={reorderTasks}
              onCreate={handleOpenCreate}
              onClearFilters={handleClearFilters}
            />
          </section>
        </div>
      </main>

      {isFormOpen && (
        <TaskFormDialog
          key={editingTask?.id ?? 'new-task'}
          initialTask={editingTask}
          defaultAssignedDate={defaultAssignedDate}
          today={today}
          projects={projects}
          onClose={handleCloseForm}
          onSave={handleSaveTask}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteDialog
          taskTitle={deleteTarget.title}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {isStatisticsOpen && (
        <StatisticsDialog
          statistics={statistics}
          onClose={() => setIsStatisticsOpen(false)}
        />
      )}

      {isSettingsOpen && (
        <SettingsDialog
          settings={settings}
          notificationPermission={notificationPermission}
          taskCount={tasks.length}
          authStatus={isAuthenticated ? 'authenticated' : 'guest'}
          user={auth.user}
          activeListName={auth.activeList?.name ?? null}
          syncStatus={syncStatus}
          localTaskCount={localTasks.length}
          pwaInstall={{ ...pwaInstall, install: handleInstallPwa }}
          onUpdateSettings={updateSettings}
          onEnableNotifications={handleEnableNotifications}
          onExport={handleExport}
          onImportFile={handleImportFile}
          onOpenAuth={handleOpenAuth}
          onOpenLists={handleOpenLists}
          onLogout={handleLogout}
          onMigrateLocal={handleMigrateLocal}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {isAuthOpen && auth.status === 'guest' && (
        <AuthScreen
          error={auth.error}
          busy={auth.isBusy}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onClose={() => {
            setIsAuthOpen(false)
            dismissAuthError()
          }}
        />
      )}

      {isListsOpen && isAuthenticated && auth.user && (
        <ListsDialog
          user={auth.user}
          lists={auth.lists}
          activeListId={auth.activeListId}
          syncStatus={syncStatus}
          busy={auth.isBusy}
          onSelectList={handleSelectList}
          onJoinList={handleJoinList}
          onCreateList={handleCreateList}
          onLeaveList={handleLeaveList}
          onLogout={handleLogout}
          onClose={() => setIsListsOpen(false)}
        />
      )}

      {toast && (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={dismissToast}
        />
      )}
    </div>
  )
}

export default App
