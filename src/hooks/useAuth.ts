import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createTaskList,
  fetchLists,
  fetchSession,
  isAuthError,
  joinTaskList,
  leaveTaskList,
  loginAccount,
  logoutAccount,
  registerAccount,
  type LoginInput,
  type RegistrationInput,
} from '../data/apiClient'
import {
  clearAllCachedTasks,
  clearCachedTasks,
} from '../data/remoteCache'
import {
  clearCachedSession,
  readCachedSession,
  saveCachedSession,
} from '../data/sessionCache'
import type { AuthUser, TaskList } from '../types'

const ACTIVE_LIST_KEY = 'dialista:active-list'

export type AuthStatus = 'loading' | 'guest' | 'authenticated'

export interface UseAuthResult {
  status: AuthStatus
  user: AuthUser | null
  lists: TaskList[]
  activeListId: string | null
  activeList: TaskList | null
  error: string | null
  isBusy: boolean
  login: (input: LoginInput) => Promise<void>
  register: (input: RegistrationInput) => Promise<void>
  logout: () => Promise<void>
  joinList: (code: string) => Promise<TaskList>
  createList: (name: string) => Promise<TaskList>
  leaveList: (listId: string) => Promise<void>
  selectList: (listId: string) => void
  refreshLists: () => Promise<void>
  handleSessionExpired: () => void
  dismissError: () => void
}

function readStoredListId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_LIST_KEY)
  } catch {
    return null
  }
}

function storeListId(listId: string | null): void {
  try {
    if (listId) window.localStorage.setItem(ACTIVE_LIST_KEY, listId)
    else window.localStorage.removeItem(ACTIVE_LIST_KEY)
  } catch {
    // La preferencia es secundaria: si falla, se elige la primera lista.
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'No se ha podido completar la operación.'
}

/** Borra del dispositivo la sesión mínima y las copias de tareas. */
function forgetAccountOnDevice(): void {
  clearCachedSession()
  clearAllCachedTasks()
}

export function useAuth(): UseAuthResult {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [lists, setLists] = useState<TaskList[]>([])
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const activeListIdRef = useRef<string | null>(null)

  const chooseList = useCallback((listId: string | null) => {
    activeListIdRef.current = listId
    setActiveListId(listId)
    storeListId(listId)
  }, [])

  const pickList = useCallback(
    (available: readonly TaskList[], preferredId?: string | null): string | null => {
      if (
        preferredId &&
        available.some((list) => list.id === preferredId)
      ) {
        return preferredId
      }

      const stored = activeListIdRef.current ?? readStoredListId()
      if (stored && available.some((list) => list.id === stored)) {
        return stored
      }

      return available[0]?.id ?? null
    },
    [],
  )

  const applySession = useCallback(
    (
      session: { user: AuthUser; lists: TaskList[] },
      preferredListId?: string | null,
    ) => {
      setUser(session.user)
      setLists(session.lists)
      chooseList(pickList(session.lists, preferredListId))
      setStatus('authenticated')
      setError(null)
      saveCachedSession(session)
    },
    [chooseList, pickList],
  )

  useEffect(() => {
    const controller = new AbortController()
    let mounted = true

    // Si el servidor no responde, no bloqueamos la app: se entra en modo
    // local y el aviso explica cómo volver a intentarlo.
    const timeoutId = window.setTimeout(() => controller.abort(), 6000)

    fetchSession(controller.signal)
      .then((session) => {
        if (mounted) applySession(session)
      })
      .catch((caught: unknown) => {
        if (!mounted) return

        if (isAuthError(caught)) {
          forgetAccountOnDevice()
          setStatus('guest')
          setUser(null)
          setLists([])
          chooseList(null)
          setError(null)
          return
        }

        // Sin conexión: si hay una sesión guardada, la app sigue mostrando la
        // cuenta y la última copia de las tareas en lugar de caer al modo local.
        const cached = readCachedSession()
        if (cached) {
          applySession(cached)
          setError(
            'Sin conexión. Se muestra la última copia guardada en este dispositivo.',
          )
          return
        }

        setStatus('guest')
        setUser(null)
        setLists([])
        chooseList(null)
        setError(
          'No se ha podido conectar con el servidor. DíaLista funciona en modo local hasta que recuperes la conexión.',
        )
      })
      .finally(() => window.clearTimeout(timeoutId))

    return () => {
      mounted = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [applySession, chooseList])

  const login = useCallback(
    async (input: LoginInput) => {
      setIsBusy(true)
      setError(null)
      try {
        const session = await loginAccount(input)
        applySession(session)
      } catch (caught) {
        setError(errorMessage(caught))
        throw caught
      } finally {
        setIsBusy(false)
      }
    },
    [applySession],
  )

  const register = useCallback(
    async (input: RegistrationInput) => {
      setIsBusy(true)
      setError(null)
      try {
        const session = await registerAccount(input)
        applySession(session)
      } catch (caught) {
        setError(errorMessage(caught))
        throw caught
      } finally {
        setIsBusy(false)
      }
    },
    [applySession],
  )

  const logout = useCallback(async () => {
    setIsBusy(true)
    try {
      await logoutAccount()
    } catch {
      // Aunque el servidor no responda, la sesión local se cierra.
    } finally {
      forgetAccountOnDevice()
      setUser(null)
      setLists([])
      chooseList(null)
      setStatus('guest')
      setError(null)
      setIsBusy(false)
    }
  }, [chooseList])

  const refreshLists = useCallback(async () => {
    try {
      const payload = await fetchLists()
      setLists(payload.lists)
      chooseList(pickList(payload.lists))
      setStatus('authenticated')
      setError(null)
      if (user) saveCachedSession({ user, lists: payload.lists })
    } catch (caught) {
      if (isAuthError(caught)) {
        forgetAccountOnDevice()
        setUser(null)
        setLists([])
        chooseList(null)
        setStatus('guest')
        setError('Tu sesión ha caducado. Inicia sesión de nuevo.')
        return
      }
      setError(errorMessage(caught))
      throw caught
    }
  }, [chooseList, pickList, user])

  const joinList = useCallback(
    async (code: string) => {
      setIsBusy(true)
      try {
        const { list } = await joinTaskList(code)
        const payload = await fetchLists()
        setLists(payload.lists)
        chooseList(list.id)
        setError(null)
        if (user) saveCachedSession({ user, lists: payload.lists })
        return list
      } catch (caught) {
        setError(errorMessage(caught))
        throw caught
      } finally {
        setIsBusy(false)
      }
    },
    [chooseList, user],
  )

  const createList = useCallback(
    async (name: string) => {
      setIsBusy(true)
      try {
        const { list } = await createTaskList(name)
        const payload = await fetchLists()
        setLists(payload.lists)
        chooseList(list.id)
        setError(null)
        if (user) saveCachedSession({ user, lists: payload.lists })
        return list
      } catch (caught) {
        setError(errorMessage(caught))
        throw caught
      } finally {
        setIsBusy(false)
      }
    },
    [chooseList, user],
  )

  const leaveList = useCallback(
    async (listId: string) => {
      setIsBusy(true)
      try {
        await leaveTaskList(listId)
        clearCachedTasks(listId)
        const payload = await fetchLists()
        setLists(payload.lists)
        chooseList(pickList(payload.lists))
        setError(null)
        if (user) saveCachedSession({ user, lists: payload.lists })
      } catch (caught) {
        setError(errorMessage(caught))
        throw caught
      } finally {
        setIsBusy(false)
      }
    },
    [chooseList, pickList, user],
  )

  const selectList = useCallback(
    (listId: string) => {
      if (lists.some((list) => list.id === listId)) {
        chooseList(listId)
      }
    },
    [chooseList, lists],
  )

  const handleSessionExpired = useCallback(() => {
    forgetAccountOnDevice()
    setUser(null)
    setLists([])
    chooseList(null)
    setStatus('guest')
    setError('Tu sesión ha caducado. Inicia sesión de nuevo.')
  }, [chooseList])

  const dismissError = useCallback(() => setError(null), [])

  return {
    status,
    user,
    lists,
    activeListId,
    activeList:
      lists.find((list) => list.id === activeListId) ?? null,
    error,
    isBusy,
    login,
    register,
    logout,
    joinList,
    createList,
    leaveList,
    selectList,
    refreshLists,
    handleSessionExpired,
    dismissError,
  }
}
