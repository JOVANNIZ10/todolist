import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Store, nextTimestamp } from './store.ts'
import type { Task } from './types.ts'

const directories: string[] = []

async function createDataFile(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'dialista-store-'))
  directories.push(directory)
  return join(directory, 'dialista.json')
}

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Tarea ${id}`,
    description: '',
    status: 'pending',
    priority: 'medium',
    assignedDate: '2026-04-01',
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

afterEach(async () => {
  while (directories.length > 0) {
    const directory = directories.pop()
    if (directory) await rm(directory, { recursive: true, force: true })
  }
})

describe('nextTimestamp', () => {
  it('garantiza versiones estrictamente crecientes', () => {
    const now = new Date('2026-04-01T10:00:00.000Z')

    expect(nextTimestamp(undefined, now)).toBe(now.toISOString())
    expect(
      nextTimestamp('2026-04-01T10:00:00.000Z', now),
    ).toBe('2026-04-01T10:00:00.001Z')
    expect(
      nextTimestamp('2026-04-01T10:00:05.000Z', now),
    ).toBe('2026-04-01T10:00:05.001Z')
  })

  it('usa el reloj cuando ya es posterior a la versión anterior', () => {
    expect(
      nextTimestamp(
        '2026-04-01T09:00:00.000Z',
        new Date('2026-04-01T10:00:00.000Z'),
      ),
    ).toBe('2026-04-01T10:00:00.000Z')
  })
})

describe('Store', () => {
  it('crea la base, persiste tareas y conserva las lápidas al reabrir', async () => {
    const dataFile = await createDataFile()
    const store = await Store.open(dataFile)
    const task = makeTask('task-1')
    const now = new Date('2026-04-01T10:00:00.000Z')

    store.upsertTask('list-1', task, now)
    await store.save()

    const reloaded = await Store.open(dataFile)
    expect(reloaded.taskChanges('list-1')).toHaveLength(1)
    expect(reloaded.taskChanges('list-1')[0]?.task.title).toBe('Tarea task-1')

    const tombstone = reloaded.tombstoneTask(
      'list-1',
      'task-1',
      new Date('2026-04-01T10:05:00.000Z'),
    )
    expect(tombstone?.deleted).toBe(true)
    await reloaded.save()

    const finalStore = await Store.open(dataFile)
    expect(finalStore.taskChanges('list-1')).toHaveLength(0)
    expect(
      finalStore.taskChanges(
        'list-1',
        '2026-04-01T10:00:00.000Z',
      ),
    ).toMatchObject([{ deleted: true }])
  })

  it('filtra los cambios por cursor y no incluye lápidas en la instantánea', async () => {
    const dataFile = await createDataFile()
    const store = await Store.open(dataFile)
    const base = new Date('2026-04-01T10:00:00.000Z')

    store.upsertTask('list-1', makeTask('a'), base)
    store.upsertTask(
      'list-1',
      makeTask('b'),
      new Date(base.getTime() + 1000),
    )
    store.tombstoneTask(
      'list-1',
      'a',
      new Date(base.getTime() + 2000),
    )

    expect(store.taskChanges('list-1').map((entry) => entry.task.id)).toEqual([
      'b',
    ])

    const since = store.taskChanges(
      'list-1',
      new Date(base.getTime() + 500).toISOString(),
    )
    expect(since.map((entry) => entry.task.id).sort()).toEqual(['a', 'b'])
    expect(since.find((entry) => entry.task.id === 'a')?.deleted).toBe(true)

    expect(store.taskChanges('other-list')).toEqual([])
  })

  it('elimina listas y usuarios junto con sus tareas y sesiones', async () => {
    const dataFile = await createDataFile()
    const store = await Store.open(dataFile)

    store.data.users.push(
      {
        id: 'user-1',
        name: 'Ana',
        email: 'ana@example.com',
        passwordHash: 'scrypt:x:y',
        createdAt: '2026-04-01T09:00:00.000Z',
      },
      {
        id: 'user-2',
        name: 'Beto',
        email: 'beto@example.com',
        passwordHash: 'scrypt:x:y',
        createdAt: '2026-04-01T09:00:00.000Z',
      },
    )
    store.data.sessions.push({
      tokenHash: 'hash',
      userId: 'user-1',
      createdAt: '2026-04-01T09:00:00.000Z',
      expiresAt: '2026-05-01T09:00:00.000Z',
    })
    store.data.lists.push({
      id: 'list-1',
      name: 'Lista',
      ownerId: 'user-1',
      inviteCode: 'ABC12345',
      memberIds: ['user-1', 'user-2'],
      createdAt: '2026-04-01T09:00:00.000Z',
    })
    store.upsertTask(
      'list-1',
      makeTask('task-1'),
      new Date('2026-04-01T10:00:00.000Z'),
    )

    store.removeUser('user-1')

    expect(store.findUserById('user-1')).toBeUndefined()
    expect(store.findSession('hash')).toBeUndefined()
    expect(store.findListById('list-1')).toBeUndefined()
    expect(store.findTask('list-1', 'task-1')).toBeUndefined()
  })

  it('no sobrescribe un archivo con JSON dañado', async () => {
    const dataFile = await createDataFile()
    const corrupted = '{ esto no es json'
    await writeFile(dataFile, corrupted, 'utf8')

    await expect(Store.open(dataFile)).rejects.toThrow(/JSON válido/)
    expect(await readFile(dataFile, 'utf8')).toBe(corrupted)
  })

  it('rechaza bases creadas por una versión más reciente', async () => {
    const dataFile = await createDataFile()
    await writeFile(
      dataFile,
      JSON.stringify({
        schemaVersion: 99,
        users: [],
        sessions: [],
        lists: [],
        tasks: [],
      }),
      'utf8',
    )

    await expect(Store.open(dataFile)).rejects.toThrow(/más reciente/)
  })

  it('poda las sesiones caducadas', async () => {
    const dataFile = await createDataFile()
    const store = await Store.open(dataFile)

    store.data.sessions.push(
      {
        tokenHash: 'expired',
        userId: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-02-01T00:00:00.000Z',
      },
      {
        tokenHash: 'valid',
        userId: 'user-1',
        createdAt: '2026-03-01T00:00:00.000Z',
        expiresAt: '2026-05-01T00:00:00.000Z',
      },
    )

    const removed = store.pruneExpiredSessions(
      new Date('2026-04-01T00:00:00.000Z'),
    )
    expect(removed).toBe(1)
    expect(store.findSession('expired')).toBeUndefined()
    expect(store.findSession('valid')).toBeDefined()
  })
})
