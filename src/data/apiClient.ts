import type {
  AuthUser,
  RejectedTask,
  Task,
  TaskChange,
  TaskList,
} from '../types'

const API_BASE = '/api'

export class ApiError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(message: string, status: number, code: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function isAuthError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 401
}

/** Fallo de red: el servidor no ha llegado a responder. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0
}

function readErrorBody(value: unknown): { message?: string; code?: string } {
  if (typeof value !== 'object' || value === null) return {}

  const record = value as Record<string, unknown>
  return {
    message: typeof record.error === 'string' ? record.error : undefined,
    code: typeof record.code === 'string' ? record.code : undefined,
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      credentials: 'include',
      cache: 'no-store',
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ApiError(
      'No se ha podido conectar con el servidor. Comprueba tu conexión.',
      0,
    )
  }

  const text = await response.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }

  if (!response.ok) {
    const parsed = readErrorBody(body)
    throw new ApiError(
      parsed.message ??
        `El servidor ha respondido con un error (${response.status}).`,
      response.status,
      parsed.code ?? null,
    )
  }

  return body as T
}

export interface SessionPayload {
  user: AuthUser
  lists: TaskList[]
}

export interface TasksPayload {
  changes: TaskChange[]
  serverTime: string
}

export interface TaskChangePayload {
  change: TaskChange
  serverTime: string
}

export interface BulkTasksPayload {
  changes: TaskChange[]
  rejected: RejectedTask[]
  serverTime: string
}

export interface RegistrationInput {
  name: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export function registerAccount(
  input: RegistrationInput,
): Promise<SessionPayload> {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function loginAccount(input: LoginInput): Promise<SessionPayload> {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function logoutAccount(): Promise<{ ok: boolean }> {
  return request('/auth/logout', { method: 'POST' })
}

export function fetchSession(signal?: AbortSignal): Promise<SessionPayload> {
  return request('/auth/session', { signal })
}

export function fetchLists(signal?: AbortSignal): Promise<{ lists: TaskList[] }> {
  return request('/lists', { signal })
}

export function createTaskList(name: string): Promise<{ list: TaskList }> {
  return request('/lists', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function joinTaskList(code: string): Promise<{ list: TaskList }> {
  return request('/lists/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export function leaveTaskList(listId: string): Promise<{ ok: boolean }> {
  return request(`/lists/${encodeURIComponent(listId)}/leave`, {
    method: 'POST',
  })
}

export function fetchTaskChanges(
  listId: string,
  since?: string,
  signal?: AbortSignal,
): Promise<TasksPayload> {
  const query = since ? `?since=${encodeURIComponent(since)}` : ''
  return request(`/lists/${encodeURIComponent(listId)}/tasks${query}`, {
    signal,
  })
}

export function putTask(
  listId: string,
  task: Task,
): Promise<TaskChangePayload> {
  return request(`/lists/${encodeURIComponent(listId)}/tasks`, {
    method: 'PUT',
    body: JSON.stringify({ task }),
  })
}

export function putTasks(
  listId: string,
  tasks: readonly Task[],
  signal?: AbortSignal,
): Promise<BulkTasksPayload> {
  return request(`/lists/${encodeURIComponent(listId)}/tasks/bulk`, {
    method: 'POST',
    body: JSON.stringify({ tasks }),
    signal,
  })
}

export function deleteRemoteTask(
  listId: string,
  taskId: string,
): Promise<TaskChangePayload> {
  return request(
    `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: 'DELETE' },
  )
}

export function taskEventsUrl(listId: string, since: string): string {
  return `${API_BASE}/lists/${encodeURIComponent(listId)}/events?since=${encodeURIComponent(since)}`
}
