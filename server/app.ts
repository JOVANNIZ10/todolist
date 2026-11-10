import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import express, {
  type Express,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express'
import {
  SESSION_COOKIE,
  RateLimiter,
  clearSessionCookie,
  createInviteCode,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  parseCookies,
  serializeSessionCookie,
  verifyPassword,
} from './auth.ts'
import { Store } from './store.ts'
import type {
  ListRecord,
  PublicUser,
  RejectedTask,
  TaskChange,
  TaskRecord,
  UserRecord,
} from './types.ts'
import {
  ValidationError,
  isRecord,
  normalizeInviteCode,
  normalizeListName,
  normalizeLogin,
  normalizeRegistration,
  normalizeTaskPayload,
} from './validation.ts'

declare global {
  namespace Express {
    interface Request {
      authUser?: UserRecord
      authCookieHash?: string
    }
  }
}

export interface CreateAppOptions {
  dataFile: string
  staticDir?: string | null
  sessionTtlMs?: number
  secureCookies?: boolean
  authRateLimit?: { windowMs: number; max: number } | false
  trustProxy?: boolean
  bodyLimit?: string
  now?: () => Date
  logger?: Pick<Console, 'error'> | null
}

export interface AppBundle {
  app: Express
  store: Store
}

interface SseClient {
  response: Response
  listId: string
  userId: string
}

function publicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  }
}

function toChange(record: TaskRecord): TaskChange {
  return {
    task: record.task,
    updatedAt: record.updatedAt,
    deleted: record.deleted,
  }
}

function sanitizeSince(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new ValidationError('El cursor de sincronización no es válido.')
  }
  return new Date(value).toISOString()
}

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export async function createApp(
  options: CreateAppOptions,
): Promise<AppBundle> {
  const store = await Store.open(options.dataFile)
  const app = express()
  const nowDate = options.now ?? (() => new Date())
  const isoNow = () => nowDate().toISOString()
  const sessionTtlMs = options.sessionTtlMs ?? 30 * 24 * 60 * 60 * 1000
  const secureCookies = options.secureCookies === true
  const logger = options.logger === undefined ? console : options.logger
  const bodyLimit = options.bodyLimit ?? '5mb'
  const sseClients = new Set<SseClient>()
  const rateLimiter =
    options.authRateLimit === false
      ? null
      : new RateLimiter(
          options.authRateLimit?.max ?? 30,
          options.authRateLimit?.windowMs ?? 10 * 60 * 1000,
        )

  if (options.trustProxy) app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    )
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store')
    }
    next()
  })

  // Protección CSRF para peticiones de escritura: el navegador debe enviar un
  // Origin del mismo host. Las herramientas sin Origin (curl, pruebas) pasan,
  // pero no pueden reutilizar cookies desde otro sitio.
  app.use((req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      next()
      return
    }

    const origin = req.get('origin')
    if (!origin) {
      next()
      return
    }

    try {
      if (new URL(origin).host !== req.get('host')) {
        res.status(403).json({ error: 'Origen no permitido.' })
        return
      }
    } catch {
      res.status(403).json({ error: 'Origen no permitido.' })
      return
    }

    next()
  })

  app.use(express.json({ limit: bodyLimit }))

  const unauthorized = (res: Response) => {
    res.status(401).json({
      error: 'Tu sesión ha caducado. Inicia sesión de nuevo.',
      code: 'AUTH_REQUIRED',
    })
  }

  const requireAuth: RequestHandler = (req, res, next) => {
    const token = parseCookies(req.headers.cookie).get(SESSION_COOKIE)
    if (!token) {
      unauthorized(res)
      return
    }

    const tokenHash = hashSessionToken(token)
    const session = store.findSession(tokenHash)
    if (!session || Date.parse(session.expiresAt) <= nowDate().getTime()) {
      unauthorized(res)
      return
    }

    const user = store.findUserById(session.userId)
    if (!user) {
      unauthorized(res)
      return
    }

    req.authUser = user
    req.authCookieHash = tokenHash
    next()
  }

  const listForMember = (
    req: Request,
    res: Response,
  ): ListRecord | null => {
    const list = store.findListById(routeParam(req.params.listId))
    const user = req.authUser
    if (!list || !user || !list.memberIds.includes(user.id)) {
      res.status(404).json({
        error: 'La lista no existe o no tienes acceso a ella.',
        code: 'LIST_NOT_FOUND',
      })
      return null
    }
    return list
  }

  const summarizeList = (list: ListRecord, userId: string) => ({
    id: list.id,
    name: list.name,
    ownerId: list.ownerId,
    createdAt: list.createdAt,
    memberCount: list.memberIds.length,
    members: list.memberIds
      .map((memberId) => store.findUserById(memberId))
      .filter((member): member is UserRecord => member !== undefined)
      .map((member) => ({ id: member.id, name: member.name })),
    inviteCode: list.inviteCode,
    role: list.ownerId === userId ? ('owner' as const) : ('member' as const),
  })

  const sessionPayload = (user: UserRecord) => ({
    user: publicUser(user),
    lists: store
      .listsForUser(user.id)
      .map((list) => summarizeList(list, user.id)),
  })

  const uniqueInviteCode = (): string => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const code = createInviteCode()
      if (!store.findListByInviteCode(code)) return code
    }
    throw new Error('No se ha podido generar un código de invitación único.')
  }

  const createSession = (userId: string): string => {
    const now = nowDate()
    store.pruneExpiredSessions(now)

    const userSessions = store.data.sessions
      .filter((session) => session.userId === userId)
      .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
    while (userSessions.length >= 20) {
      const oldest = userSessions.shift()
      if (oldest) store.removeSession(oldest.tokenHash)
    }

    const token = createSessionToken()
    store.data.sessions.push({
      tokenHash: hashSessionToken(token),
      userId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + sessionTtlMs).toISOString(),
    })
    return token
  }

  const setSessionCookie = (res: Response, token: string) => {
    res.setHeader(
      'Set-Cookie',
      serializeSessionCookie(
        token,
        Math.floor(Math.max(0, sessionTtlMs) / 1000),
        secureCookies,
      ),
    )
  }

  const checkRateLimit = (
    req: Request,
    res: Response,
    scope: string,
  ): boolean => {
    if (!rateLimiter) return true

    const result = rateLimiter.take(`${scope}:${req.ip ?? 'unknown'}`)
    if (result.allowed) return true

    res.setHeader('Retry-After', String(result.retryAfterSeconds))
    res.status(429).json({
      error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
    })
    return false
  }

  const broadcast = (
    listId: string,
    changes: TaskChange[],
    serverTime: string,
  ) => {
    if (changes.length === 0) return
    const frame = `event: sync\ndata: ${JSON.stringify({
      changes,
      serverTime,
    })}\n\n`

    for (const client of sseClients) {
      if (client.listId !== listId) continue
      try {
        client.response.write(frame)
      } catch {
        sseClients.delete(client)
      }
    }
  }

  /**
   * El hash ficticio permite comparar contraseñas también cuando el correo no
   * existe, de modo que el tiempo de respuesta no revele cuentas registradas.
   */
  const dummyPasswordHash = await hashPassword(
    'dialista-placeholder-not-a-real-password',
  )

  // ---------------------------------------------------------------------------
  // Salud
  // ---------------------------------------------------------------------------

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, schemaVersion: store.data.schemaVersion })
  })

  // ---------------------------------------------------------------------------
  // Autenticación
  // ---------------------------------------------------------------------------

  app.post('/api/auth/register', async (req, res) => {
    if (!checkRateLimit(req, res, 'register')) return

    const input = normalizeRegistration(req.body)
    if (store.findUserByEmail(input.email)) {
      res.status(409).json({
        error: 'Ya existe una cuenta con ese correo electrónico.',
        code: 'EMAIL_TAKEN',
      })
      return
    }

    const createdAt = isoNow()
    const user: UserRecord = {
      id: `user-${randomUUID()}`,
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      createdAt,
    }
    const list: ListRecord = {
      id: `list-${randomUUID()}`,
      name: `Tareas de ${user.name}`.slice(0, 80),
      ownerId: user.id,
      inviteCode: uniqueInviteCode(),
      memberIds: [user.id],
      createdAt,
    }

    store.data.users.push(user)
    store.data.lists.push(list)
    const token = createSession(user.id)

    await store.save()
    setSessionCookie(res, token)
    res.status(201).json(sessionPayload(user))
  })

  app.post('/api/auth/login', async (req, res) => {
    if (!checkRateLimit(req, res, 'login')) return

    const input = normalizeLogin(req.body)
    const user = store.findUserByEmail(input.email)
    const valid = await verifyPassword(
      input.password,
      user?.passwordHash ?? dummyPasswordHash,
    )

    if (!user || !valid) {
      res.status(401).json({
        error: 'El correo o la contraseña no son correctos.',
        code: 'INVALID_CREDENTIALS',
      })
      return
    }

    const token = createSession(user.id)
    await store.save()
    setSessionCookie(res, token)
    res.json(sessionPayload(user))
  })

  app.post('/api/auth/logout', async (req, res) => {
    const token = parseCookies(req.headers.cookie).get(SESSION_COOKIE)
    if (token) {
      const removed = store.removeSession(hashSessionToken(token))
      if (removed) await store.save()
    }

    res.setHeader('Set-Cookie', clearSessionCookie(secureCookies))
    res.json({ ok: true })
  })

  app.get('/api/auth/session', requireAuth, (req, res) => {
    res.json(sessionPayload(req.authUser as UserRecord))
  })

  // ---------------------------------------------------------------------------
  // Listas
  // ---------------------------------------------------------------------------

  app.get('/api/lists', requireAuth, (req, res) => {
    const user = req.authUser as UserRecord
    res.json({
      lists: store
        .listsForUser(user.id)
        .map((list) => summarizeList(list, user.id)),
    })
  })

  app.post('/api/lists', requireAuth, async (req, res) => {
    const user = req.authUser as UserRecord
    const name = normalizeListName((req.body as { name?: unknown })?.name)

    if (store.listsForUser(user.id).length >= 20) {
      res.status(409).json({
        error: 'Has alcanzado el límite de 20 listas.',
      })
      return
    }

    const list: ListRecord = {
      id: `list-${randomUUID()}`,
      name,
      ownerId: user.id,
      inviteCode: uniqueInviteCode(),
      memberIds: [user.id],
      createdAt: isoNow(),
    }
    store.data.lists.push(list)
    await store.save()

    res.status(201).json({ list: summarizeList(list, user.id) })
  })

  app.post('/api/lists/join', requireAuth, async (req, res) => {
    const user = req.authUser as UserRecord
    const code = normalizeInviteCode((req.body as { code?: unknown })?.code)
    const list = store.findListByInviteCode(code)

    if (!list) {
      res.status(404).json({
        error: 'No hay ninguna lista con ese código de invitación.',
        code: 'INVALID_INVITE',
      })
      return
    }

    if (!list.memberIds.includes(user.id)) {
      if (list.memberIds.length >= 2) {
        res.status(409).json({
          error: 'Esa lista ya tiene dos personas. Las listas compartidas admiten como máximo dos miembros.',
          code: 'LIST_FULL',
        })
        return
      }

      list.memberIds.push(user.id)
      await store.save()
    }

    res.json({ list: summarizeList(list, user.id) })
  })

  app.post('/api/lists/:listId/leave', requireAuth, async (req, res) => {
    const list = listForMember(req, res)
    if (!list) return

    const user = req.authUser as UserRecord
    list.memberIds = list.memberIds.filter((memberId) => memberId !== user.id)

    if (list.memberIds.length === 0) {
      store.removeList(list.id)
    } else if (list.ownerId === user.id) {
      list.ownerId = list.memberIds[0]
    }

    await store.save()
    res.json({ ok: true })
  })

  // ---------------------------------------------------------------------------
  // Tareas y sincronización
  // ---------------------------------------------------------------------------

  app.get('/api/lists/:listId/tasks', requireAuth, (req, res) => {
    const list = listForMember(req, res)
    if (!list) return

    const since = sanitizeSince(req.query.since)
    const serverTime = isoNow()
    const changes = store.taskChanges(list.id, since)

    res.json({ changes, serverTime })
  })

  app.put('/api/lists/:listId/tasks', requireAuth, async (req, res) => {
    const list = listForMember(req, res)
    if (!list) return

    const body: unknown = req.body
    const candidate = isRecord(body) && 'task' in body ? body.task : body
    const task = normalizeTaskPayload(candidate, nowDate())
    const record = store.upsertTask(list.id, task, nowDate())

    await store.save()
    const change = toChange(record)
    const serverTime = isoNow()
    broadcast(list.id, [change], serverTime)

    res.json({ change, serverTime })
  })

  app.post(
    '/api/lists/:listId/tasks/bulk',
    requireAuth,
    async (req, res) => {
      const list = listForMember(req, res)
      if (!list) return

      const body: unknown = req.body
      const candidates =
        isRecord(body) && Array.isArray(body.tasks) ? body.tasks : null
      if (!candidates) {
        res.status(400).json({
          error: 'Se esperaba una lista de tareas para sincronizar.',
        })
        return
      }
      if (candidates.length === 0) {
        res.json({ changes: [], rejected: [], serverTime: isoNow() })
        return
      }
      if (candidates.length > 500) {
        res.status(400).json({
          error: 'No se pueden sincronizar más de 500 tareas a la vez.',
        })
        return
      }

      const changes: TaskChange[] = []
      const rejected: RejectedTask[] = []

      for (const candidate of candidates) {
        try {
          const task = normalizeTaskPayload(candidate, nowDate())
          changes.push(toChange(store.upsertTask(list.id, task, nowDate())))
        } catch (error) {
          const id =
            isRecord(candidate) && typeof candidate.id === 'string'
              ? candidate.id
              : null
          rejected.push({
            id,
            error:
              error instanceof ValidationError
                ? error.message
                : 'La tarea no es válida.',
          })
        }
      }

      if (changes.length > 0) await store.save()
      const serverTime = isoNow()
      broadcast(list.id, changes, serverTime)

      res.json({ changes, rejected, serverTime })
    },
  )

  app.delete(
    '/api/lists/:listId/tasks/:taskId',
    requireAuth,
    async (req, res) => {
      const list = listForMember(req, res)
      if (!list) return

      const record = store.tombstoneTask(
        list.id,
        routeParam(req.params.taskId),
        nowDate(),
      )
      if (!record) {
        res.status(404).json({
          error: 'La tarea no existe en esta lista.',
          code: 'TASK_NOT_FOUND',
        })
        return
      }

      await store.save()
      const change = toChange(record)
      const serverTime = isoNow()
      broadcast(list.id, [change], serverTime)

      res.json({ change, serverTime })
    },
  )

  app.get(
    '/api/lists/:listId/events',
    requireAuth,
    (req, res) => {
      const list = listForMember(req, res)
      if (!list) return

      let since: string | undefined
      try {
        since = sanitizeSince(req.query.since)
      } catch (error) {
        res.status(400).json({
          error:
            error instanceof Error ? error.message : 'Cursor no válido.',
        })
        return
      }

      res.status(200)
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')
      res.flushHeaders()

      const user = req.authUser as UserRecord
      const client: SseClient = {
        response: res,
        listId: list.id,
        userId: user.id,
      }
      sseClients.add(client)

      res.write('retry: 3000\n\n')
      res.write(': conectado\n\n')

      const serverTime = isoNow()
      const catchUp = store.taskChanges(list.id, since)
      res.write(
        `event: sync\ndata: ${JSON.stringify({
          changes: catchUp,
          serverTime,
        })}\n\n`,
      )

      const heartbeat = setInterval(() => {
        try {
          res.write(': ping\n\n')
        } catch {
          clearInterval(heartbeat)
          sseClients.delete(client)
        }
      }, 20_000)

      const cleanup = () => {
        clearInterval(heartbeat)
        sseClients.delete(client)
      }
      req.on('close', cleanup)
      res.on('close', cleanup)
    },
  )

  // ---------------------------------------------------------------------------
  // Estáticos y errores
  // ---------------------------------------------------------------------------

  if (options.staticDir) {
    const staticDir = options.staticDir
    app.use(
      '/assets',
      express.static(join(staticDir, 'assets'), {
        immutable: true,
        maxAge: '1y',
      }),
    )
    app.use(express.static(staticDir, { index: false, maxAge: 0 }))
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next()
        return
      }
      if (req.path.startsWith('/api/')) {
        next()
        return
      }
      res.sendFile(join(staticDir, 'index.html'), (error) => {
        if (error) next(error)
      })
    })
  }

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Recurso no encontrado.' })
  })

  app.use(
    (
      error: unknown,
      _req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      if (res.headersSent) {
        next(error)
        return
      }

      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message, code: 'VALIDATION' })
        return
      }

      if (
        error instanceof SyntaxError &&
        isRecord(error) &&
        'body' in error
      ) {
        res.status(400).json({ error: 'El cuerpo JSON no es válido.' })
        return
      }

      if (isRecord(error) && error.type === 'entity.too.large') {
        res.status(413).json({ error: 'La petición es demasiado grande.' })
        return
      }

      logger?.error('Error interno del servidor:', error)
      res.status(500).json({
        error: 'Se ha producido un error interno. Inténtalo de nuevo.',
      })
    },
  )

  return { app, store }
}
