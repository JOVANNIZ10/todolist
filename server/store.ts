import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import {
  SERVER_SCHEMA_VERSION,
  type Database,
  type ListRecord,
  type SessionRecord,
  type Task,
  type TaskChange,
  type TaskRecord,
  type UserRecord,
} from './types.ts'

export function createEmptyDatabase(): Database {
  return {
    schemaVersion: SERVER_SCHEMA_VERSION,
    users: [],
    sessions: [],
    lists: [],
    tasks: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function writeAtomic(filePath: string, contents: string): Promise<void> {
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporaryPath, contents, { encoding: 'utf8', mode: 0o600 })

  let lastError: unknown
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await rename(temporaryPath, filePath)
      return
    } catch (error) {
      lastError = error
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : ''
      if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') {
        break
      }
      await delay(40 * (attempt + 1))
    }
  }

  await rm(temporaryPath, { force: true }).catch(() => undefined)
  throw lastError instanceof Error
    ? lastError
    : new Error('No se ha podido escribir la base de datos.')
}

export function nextTimestamp(previous: string | undefined, now: Date): string {
  if (!previous) return now.toISOString()

  const previousMs = Date.parse(previous)
  if (Number.isNaN(previousMs)) return now.toISOString()

  return new Date(Math.max(now.getTime(), previousMs + 1)).toISOString()
}

/**
 * Base de datos JSON con escritura atómica y cola de guardado.
 *
 * El archivo se mantiene íntegro: primero se escribe un temporal en el mismo
 * directorio y después se renombra. Si el JSON está dañado, la apertura falla
 * en lugar de sobrescribir datos que podrían recuperarse.
 */
export class Store {
  readonly filePath: string
  readonly data: Database
  private writeChain: Promise<void> = Promise.resolve()

  private constructor(filePath: string, data: Database) {
    this.filePath = filePath
    this.data = data
  }

  static async open(filePath: string): Promise<Store> {
    await mkdir(dirname(filePath), { recursive: true })

    let raw: string
    try {
      raw = await readFile(filePath, 'utf8')
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : ''
      if (code !== 'ENOENT') throw error

      const store = new Store(filePath, createEmptyDatabase())
      await store.save()
      return store
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error(
        `La base de datos ${filePath} no contiene JSON válido. No se ha modificado; revisa el archivo o restaura una copia.`,
      )
    }

    if (!isRecord(parsed) || !Array.isArray(parsed.users)) {
      throw new Error(
        `La base de datos ${filePath} no tiene el formato esperado. No se ha modificado.`,
      )
    }

    const schemaVersion =
      typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 0
    if (schemaVersion > SERVER_SCHEMA_VERSION) {
      throw new Error(
        'La base de datos fue creada por una versión más reciente de DíaLista. Actualiza el servidor antes de abrirla.',
      )
    }
    if (
      !Array.isArray(parsed.sessions) ||
      !Array.isArray(parsed.lists) ||
      !Array.isArray(parsed.tasks)
    ) {
      throw new Error(
        `La base de datos ${filePath} está incompleta. No se ha modificado.`,
      )
    }

    const data: Database = {
      schemaVersion: SERVER_SCHEMA_VERSION,
      users: parsed.users as UserRecord[],
      sessions: parsed.sessions as SessionRecord[],
      lists: parsed.lists as ListRecord[],
      tasks: parsed.tasks as TaskRecord[],
    }

    return new Store(filePath, data)
  }

  /** Guarda una instantánea de la base; las escrituras se encadenan en orden. */
  save(): Promise<void> {
    const snapshot = JSON.stringify(this.data, null, 2)
    const write = this.writeChain.then(() =>
      writeAtomic(this.filePath, snapshot),
    )
    this.writeChain = write.catch(() => undefined)
    return write
  }

  findUserById(id: string): UserRecord | undefined {
    return this.data.users.find((user) => user.id === id)
  }

  findUserByEmail(email: string): UserRecord | undefined {
    return this.data.users.find((user) => user.email === email)
  }

  findSession(tokenHash: string): SessionRecord | undefined {
    return this.data.sessions.find(
      (session) => session.tokenHash === tokenHash,
    )
  }

  removeSession(tokenHash: string): boolean {
    const index = this.data.sessions.findIndex(
      (session) => session.tokenHash === tokenHash,
    )
    if (index === -1) return false
    this.data.sessions.splice(index, 1)
    return true
  }

  findListById(id: string): ListRecord | undefined {
    return this.data.lists.find((list) => list.id === id)
  }

  findListByInviteCode(code: string): ListRecord | undefined {
    return this.data.lists.find((list) => list.inviteCode === code)
  }

  listsForUser(userId: string): ListRecord[] {
    return this.data.lists
      .filter((list) => list.memberIds.includes(userId))
      .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
  }

  findTask(listId: string, taskId: string): TaskRecord | undefined {
    return this.data.tasks.find(
      (record) => record.listId === listId && record.task.id === taskId,
    )
  }

  upsertTask(
    listId: string,
    task: Task,
    now: Date,
  ): TaskRecord {
    const existing = this.findTask(listId, task.id)
    const record: TaskRecord = {
      listId,
      task,
      updatedAt: nextTimestamp(existing?.updatedAt, now),
      deleted: false,
    }

    if (existing) {
      const index = this.data.tasks.indexOf(existing)
      this.data.tasks[index] = record
    } else {
      this.data.tasks.push(record)
    }

    return record
  }

  tombstoneTask(
    listId: string,
    taskId: string,
    now: Date,
  ): TaskRecord | null {
    const existing = this.findTask(listId, taskId)
    if (!existing) return null

    const record: TaskRecord = {
      ...existing,
      updatedAt: nextTimestamp(existing.updatedAt, now),
      deleted: true,
    }
    const index = this.data.tasks.indexOf(existing)
    this.data.tasks[index] = record
    return record
  }

  taskChanges(listId: string, since?: string): TaskChange[] {
    const records = this.data.tasks.filter(
      (record) => record.listId === listId,
    )
    const sinceMs = since ? Date.parse(since) : Number.NaN

    // Sin cursor: instantánea completa sin lápidas. Con cursor: todo lo
    // modificado desde ese instante, incluidas las eliminaciones.
    const selected = Number.isNaN(sinceMs)
      ? records.filter((record) => !record.deleted)
      : records.filter(
          (record) => Date.parse(record.updatedAt) >= sinceMs,
        )

    return selected.map((record) => ({
      task: record.task,
      updatedAt: record.updatedAt,
      deleted: record.deleted,
    }))
  }

  removeList(listId: string): void {
    const listIndex = this.data.lists.findIndex((list) => list.id === listId)
    if (listIndex !== -1) this.data.lists.splice(listIndex, 1)

    this.data.tasks = this.data.tasks.filter(
      (record) => record.listId !== listId,
    )
  }

  removeUser(userId: string): void {
    this.data.users = this.data.users.filter((user) => user.id !== userId)
    this.data.sessions = this.data.sessions.filter(
      (session) => session.userId !== userId,
    )
    const ownedLists = this.data.lists.filter(
      (list) => list.ownerId === userId,
    )
    for (const list of ownedLists) this.removeList(list.id)
  }

  pruneExpiredSessions(now: Date): number {
    const nowMs = now.getTime()
    const before = this.data.sessions.length
    this.data.sessions = this.data.sessions.filter(
      (session) => Date.parse(session.expiresAt) > nowMs,
    )
    return before - this.data.sessions.length
  }
}
