import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, type CreateAppOptions } from './app.ts'
import type { Task } from './types.ts'

interface ApiResult {
  status: number
  body: unknown
  headers: Headers
}

interface TestServer {
  baseUrl: string
  dataFile: string
  close: () => Promise<void>
}

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Tarea ${id}`,
    description: '',
    status: 'pending',
    priority: 'medium',
    assignedDate: '2026-03-10',
    time: null,
    project: null,
    createdAt: '2026-03-01T09:00:00.000Z',
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

class TestClient {
  private cookie = ''
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  getCookie(): string {
    return this.cookie
  }

  private captureCookies(response: Response): void {
    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(';', 1)[0] ?? ''
      const separator = pair.indexOf('=')
      if (separator === -1) continue

      const name = pair.slice(0, separator)
      const value = pair.slice(separator + 1)
      if (name !== 'dialista_session') continue

      if (!value || /max-age=0/i.test(raw)) {
        this.cookie = ''
      } else {
        this.cookie = `${name}=${value}`
      }
    }
  }

  async request(
    path: string,
    init: RequestInit = {},
  ): Promise<ApiResult> {
    const headers = new Headers(init.headers)
    if (init.body !== undefined && !headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }
    if (this.cookie) headers.set('cookie', this.cookie)

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    })
    this.captureCookies(response)

    const text = await response.text()
    let body: unknown = null
    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        body = text
      }
    }

    return { status: response.status, body, headers: response.headers }
  }

  get(path: string): Promise<ApiResult> {
    return this.request(path)
  }

  post(path: string, body?: unknown): Promise<ApiResult> {
    return this.request(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  put(path: string, body: unknown): Promise<ApiResult> {
    return this.request(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  delete(path: string): Promise<ApiResult> {
    return this.request(path, { method: 'DELETE' })
  }
}

const servers: TestServer[] = []

async function startServer(
  overrides: Partial<CreateAppOptions> = {},
): Promise<TestServer> {
  const directory = await mkdtemp(join(tmpdir(), 'dialista-api-'))
  const dataFile = join(directory, 'dialista.json')
  const { app } = await createApp({
    dataFile,
    authRateLimit: false,
    logger: null,
    ...overrides,
  })

  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as AddressInfo

  const handle: TestServer = {
    baseUrl: `http://127.0.0.1:${address.port}`,
    dataFile,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
      await rm(directory, { recursive: true, force: true })
    },
  }

  servers.push(handle)
  return handle
}

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop()
    if (server) await server.close()
  }
})

async function register(
  client: TestClient,
  name: string,
  email: string,
): Promise<ApiResult> {
  return client.post('/api/auth/register', {
    name,
    email,
    password: 'secreto-seguro-123',
  })
}

function readRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Se esperaba un objeto en la respuesta.')
  }
  return value as Record<string, unknown>
}

function listFrom(result: ApiResult): Record<string, unknown> {
  return readRecord(readRecord(result.body).list)
}

function firstList(result: ApiResult): Record<string, unknown> {
  const lists = readRecord(result.body).lists
  if (!Array.isArray(lists) || lists.length === 0) {
    throw new Error('La cuenta no tiene listas.')
  }
  return readRecord(lists[0])
}

function changesFrom(result: ApiResult): Array<Record<string, unknown>> {
  const changes = readRecord(result.body).changes
  if (!Array.isArray(changes)) throw new Error('Faltan los cambios.')
  return changes.map((entry) => readRecord(entry))
}

async function readStreamUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  predicate: (text: string) => boolean,
  timeoutMs = 3000,
): Promise<string> {
  const decoder = new TextDecoder()
  let text = ''

  while (!predicate(text)) {
    let timer: ReturnType<typeof setTimeout> | null = null
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error('Tiempo de espera agotado leyendo SSE.')),
        timeoutMs,
      )
    })

    try {
      const chunk = await Promise.race([reader.read(), timeout])
      if (chunk.done) break
      text += decoder.decode(chunk.value, { stream: true })
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  return text
}

describe('API de DíaLista', () => {
  it('expone salud, registra una cuenta con su lista y gestiona la sesión', async () => {
    const server = await startServer()
    const client = new TestClient(server.baseUrl)

    const health = await client.get('/api/health')
    expect(health.status).toBe(200)
    expect(readRecord(health.body).ok).toBe(true)

    const registered = await register(
      client,
      'Ana García',
      'ana@example.com',
    )
    expect(registered.status).toBe(201)

    const session = readRecord(registered.body)
    const user = readRecord(session.user)
    expect(user.name).toBe('Ana García')
    expect(user.email).toBe('ana@example.com')
    expect(user).not.toHaveProperty('passwordHash')

    const lists = session.lists
    expect(Array.isArray(lists)).toBe(true)
    const list = readRecord((lists as unknown[])[0])
    expect(list.name).toBe('Tareas de Ana García')
    expect(list.role).toBe('owner')
    expect(list.memberCount).toBe(1)
    expect(String(list.inviteCode)).toMatch(/^[A-Z0-9]{8}$/)
    expect(client.getCookie()).toMatch(/^dialista_session=/)

    const current = await client.get('/api/auth/session')
    expect(current.status).toBe(200)
    expect(readRecord(readRecord(current.body).user).id).toBe(user.id)

    const logout = await client.post('/api/auth/logout')
    expect(logout.status).toBe(200)
    expect(client.getCookie()).toBe('')

    const expired = await client.get('/api/auth/session')
    expect(expired.status).toBe(401)
    expect(readRecord(expired.body).code).toBe('AUTH_REQUIRED')
  })

  it('rechaza registros duplicados y credenciales incorrectas', async () => {
    const server = await startServer()
    const client = new TestClient(server.baseUrl)

    expect(
      (await register(client, 'Ana', 'ana@example.com')).status,
    ).toBe(201)

    const duplicate = await register(
      client,
      'Otra Ana',
      'ANA@example.com',
    )
    expect(duplicate.status).toBe(409)
    expect(readRecord(duplicate.body).code).toBe('EMAIL_TAKEN')

    const weak = await client.post('/api/auth/register', {
      name: 'Pepito',
      email: 'pepito@example.com',
      password: 'corta',
    })
    expect(weak.status).toBe(400)

    const wrong = await client.post('/api/auth/login', {
      email: 'ana@example.com',
      password: 'no-es-la-buena',
    })
    expect(wrong.status).toBe(401)
    expect(readRecord(wrong.body).code).toBe('INVALID_CREDENTIALS')

    const missing = await client.post('/api/auth/login', {
      email: 'nadie@example.com',
      password: 'secreto-seguro-123',
    })
    expect(missing.status).toBe(401)

    const login = await client.post('/api/auth/login', {
      email: 'ana@example.com',
      password: 'secreto-seguro-123',
    })
    expect(login.status).toBe(200)
    expect(readRecord(readRecord(login.body).user).email).toBe(
      'ana@example.com',
    )
  })

  it('comparte una lista con una segunda persona y limita el acceso a dos miembros', async () => {
    const server = await startServer()
    const ana = new TestClient(server.baseUrl)
    const beto = new TestClient(server.baseUrl)
    const carla = new TestClient(server.baseUrl)

    await register(ana, 'Ana', 'ana@example.com')
    await register(beto, 'Beto', 'beto@example.com')
    await register(carla, 'Carla', 'carla@example.com')

    const anaList = firstList(await ana.get('/api/lists'))
    const code = String(anaList.inviteCode)

    const joined = await beto.post('/api/lists/join', { code })
    expect(joined.status).toBe(200)
    expect(listFrom(joined).memberCount).toBe(2)
    expect(listFrom(joined).role).toBe('member')

    const anaLists = readRecord((await ana.get('/api/lists')).body)
    const shared = readRecord((anaLists.lists as unknown[])[0])
    expect(shared.memberCount).toBe(2)
    expect((shared.members as unknown[]).length).toBe(2)

    const full = await carla.post('/api/lists/join', { code })
    expect(full.status).toBe(409)
    expect(readRecord(full.body).code).toBe('LIST_FULL')

    const invalid = await carla.post('/api/lists/join', {
      code: 'NOPE1234',
    })
    expect(invalid.status).toBe(404)
    expect(readRecord(invalid.body).code).toBe('INVALID_INVITE')

    expect((await beto.post(`/api/lists/${shared.id}/leave`)).status).toBe(
      200,
    )

    const afterwards = readRecord((await ana.get('/api/lists')).body)
    expect(readRecord((afterwards.lists as unknown[])[0]).memberCount).toBe(1)
  })

  it('transfiere la propiedad cuando la persona propietaria sale de la lista', async () => {
    const server = await startServer()
    const ana = new TestClient(server.baseUrl)
    const beto = new TestClient(server.baseUrl)

    await register(ana, 'Ana', 'ana@example.com')
    await register(beto, 'Beto', 'beto@example.com')

    const shared = firstList(await ana.get('/api/lists'))
    await beto.post('/api/lists/join', { code: shared.inviteCode })

    expect((await ana.post(`/api/lists/${shared.id}/leave`)).status).toBe(
      200,
    )

    const betoBody = readRecord((await beto.get('/api/lists')).body)
    const inherited = readRecord((betoBody.lists as unknown[])[0])
    expect(inherited.role).toBe('owner')
    expect(inherited.memberCount).toBe(1)
  })

  it('sincroniza tareas, propaga lápidas y protege listas ajenas', async () => {
    const server = await startServer()
    const ana = new TestClient(server.baseUrl)
    const beto = new TestClient(server.baseUrl)
    const carla = new TestClient(server.baseUrl)

    await register(ana, 'Ana', 'ana@example.com')
    await register(beto, 'Beto', 'beto@example.com')
    await register(carla, 'Carla', 'carla@example.com')

    const list = firstList(await ana.get('/api/lists'))
    const listId = String(list.id)
    await beto.post('/api/lists/join', { code: list.inviteCode })

    const task = makeTask('task-1', {
      title: 'Preparar la cena',
      priority: 'high',
      time: '20:00',
      reminderMinutes: 30,
    })

    const created = await ana.put(`/api/lists/${listId}/tasks`, { task })
    expect(created.status).toBe(200)
    const createdChange = readRecord(readRecord(created.body).change)
    expect(readRecord(createdChange.task).title).toBe('Preparar la cena')
    expect(createdChange.deleted).toBe(false)
    const firstTime = String(readRecord(created.body).serverTime)

    const snapshot = await beto.get(`/api/lists/${listId}/tasks`)
    expect(snapshot.status).toBe(200)
    expect(changesFrom(snapshot)).toHaveLength(1)

    const editedTask = { ...task, title: 'Cena para dos' }
    expect(
      (await beto.put(`/api/lists/${listId}/tasks`, { task: editedTask }))
        .status,
    ).toBe(200)

    const polled = await ana.get(
      `/api/lists/${listId}/tasks?since=${encodeURIComponent(firstTime)}`,
    )
    const polledChanges = changesFrom(polled)
    expect(polledChanges.length).toBeGreaterThanOrEqual(1)
    expect(
      polledChanges.some(
        (entry) => readRecord(entry.task).title === 'Cena para dos',
      ),
    ).toBe(true)

    const forbiddenRead = await carla.get(`/api/lists/${listId}/tasks`)
    expect(forbiddenRead.status).toBe(404)
    const forbiddenWrite = await carla.put(
      `/api/lists/${listId}/tasks`,
      { task },
    )
    expect(forbiddenWrite.status).toBe(404)
    const forbiddenDelete = await carla.delete(
      `/api/lists/${listId}/tasks/task-1`,
    )
    expect(forbiddenDelete.status).toBe(404)

    const removed = await beto.delete(
      `/api/lists/${listId}/tasks/task-1`,
    )
    expect(removed.status).toBe(200)
    expect(readRecord(readRecord(removed.body).change).deleted).toBe(true)

    const afterDelete = await ana.get(
      `/api/lists/${listId}/tasks?since=${encodeURIComponent(
        String(readRecord(polled.body).serverTime),
      )}`,
    )
    expect(
      changesFrom(afterDelete).some((entry) => entry.deleted === true),
    ).toBe(true)

    const cleanSnapshot = await ana.get(`/api/lists/${listId}/tasks`)
    expect(changesFrom(cleanSnapshot)).toHaveLength(0)

    const invalid = await ana.put(`/api/lists/${listId}/tasks`, {
      task: { ...task, status: 'inventado' },
    })
    expect(invalid.status).toBe(400)
  })

  it('sincroniza tareas en lote y devuelve las rechazadas sin abortar el resto', async () => {
    const server = await startServer()
    const ana = new TestClient(server.baseUrl)
    await register(ana, 'Ana', 'ana@example.com')

    const list = firstList(await ana.get('/api/lists'))
    const listId = String(list.id)
    const valid = makeTask('valid-1')
    const invalid = makeTask('invalid-1', { title: '   ' })

    const result = await ana.post(`/api/lists/${listId}/tasks/bulk`, {
      tasks: [valid, invalid],
    })
    expect(result.status).toBe(200)

    const body = readRecord(result.body)
    expect((body.changes as unknown[]).length).toBe(1)
    expect((body.rejected as unknown[]).length).toBe(1)
    const rejected = readRecord((body.rejected as unknown[])[0])
    expect(rejected.id).toBe('invalid-1')
    expect(String(rejected.error)).toContain('obligatorio')
  })

  it('emite un evento SSE inicial con la instantánea de la lista', async () => {
    const server = await startServer()
    const ana = new TestClient(server.baseUrl)
    await register(ana, 'Ana', 'ana@example.com')

    const list = firstList(await ana.get('/api/lists'))
    const listId = String(list.id)
    const task = makeTask('sse-1', { title: 'Avisar por SSE' })
    await ana.put(`/api/lists/${listId}/tasks`, { task })

    const controller = new AbortController()
    const response = await fetch(
      `${server.baseUrl}/api/lists/${listId}/events?since=${encodeURIComponent(
        '1970-01-01T00:00:00.000Z',
      )}`,
      {
        headers: {
          cookie: ana.getCookie(),
          accept: 'text/event-stream',
        },
        signal: controller.signal,
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain(
      'text/event-stream',
    )

    const reader = response.body?.getReader()
    expect(reader).toBeDefined()
    if (!reader) return

    try {
      const text = await readStreamUntil(reader, (chunk) =>
        chunk.includes('event: sync') && chunk.includes('Avisar por SSE'),
      )
      expect(text).toContain('event: sync')
      expect(text).toContain('Avisar por SSE')
    } finally {
      controller.abort()
      await reader.cancel().catch(() => undefined)
    }
  })
})
