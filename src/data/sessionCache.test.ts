import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser, TaskList } from '../types'
import {
  clearCachedSession,
  readCachedSession,
  saveCachedSession,
} from './sessionCache'

function installStorage(): Map<string, string> {
  const values = new Map<string, string>()

  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size
      },
    },
  })

  return values
}

const USER: AuthUser = {
  id: 'user-1',
  name: 'Iván',
  email: 'ivan@example.com',
  createdAt: '2026-11-01T09:00:00.000Z',
}

const LIST: TaskList = {
  id: 'list-1',
  name: 'Casa',
  ownerId: 'user-1',
  createdAt: '2026-11-01T09:00:00.000Z',
  memberCount: 2,
  members: [
    { id: 'user-1', name: 'Iván' },
    { id: 'user-2', name: 'Pareja' },
  ],
  inviteCode: 'ABC123',
  role: 'owner',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('caché de sesión', () => {
  it('guarda y recupera la copia mínima de la sesión', () => {
    installStorage()

    saveCachedSession({ user: USER, lists: [LIST] })

    expect(readCachedSession()).toEqual({ user: USER, lists: [LIST] })
  })

  it('descarta copias de una versión futura o con datos incompletos', () => {
    const values = installStorage()
    values.set(
      'dialista:session-cache',
      JSON.stringify({ version: 99, user: USER, lists: [LIST] }),
    )
    expect(readCachedSession()).toBeNull()

    values.set(
      'dialista:session-cache',
      JSON.stringify({ version: 1, user: USER, lists: [{ id: 'rota' }] }),
    )
    expect(readCachedSession()).toBeNull()
  })

  it('ignora el JSON dañado', () => {
    const values = installStorage()
    values.set('dialista:session-cache', '{esto no es json')

    expect(readCachedSession()).toBeNull()
  })

  it('borra la copia al cerrar sesión', () => {
    installStorage()
    saveCachedSession({ user: USER, lists: [LIST] })
    clearCachedSession()

    expect(readCachedSession()).toBeNull()
  })

  it('no falla cuando localStorage no está disponible', () => {
    vi.stubGlobal('window', {})

    expect(readCachedSession()).toBeNull()
    expect(() => saveCachedSession({ user: USER, lists: [LIST] })).not.toThrow()
    expect(() => clearCachedSession()).not.toThrow()
  })
})
