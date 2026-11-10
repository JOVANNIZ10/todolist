/**
 * Tipos del servidor.
 *
 * `Task` debe mantenerse en sincronía con `src/types.ts`: es el contrato que
 * viaja entre la interfaz y la API. El servidor lo revalida y normaliza antes
 * de guardarlo para no fiarse nunca de los datos del cliente.
 */

export const SERVER_SCHEMA_VERSION = 1

export type TaskStatus = 'pending' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'
export type RecurrenceFrequency = 'daily' | 'weekdays' | 'weekly' | 'monthly'

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  interval: number
}

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignedDate: string | null
  time: string | null
  project: string | null
  createdAt: string
  completedAt: string | null
  order: number
  subtasks: Subtask[]
  recurrence: RecurrenceRule | null
  reminderMinutes: number | null
  reminderNotifiedAt: string | null
  recurrenceGenerated: boolean
}

export interface UserRecord {
  id: string
  name: string
  email: string
  passwordHash: string
  createdAt: string
}

export interface SessionRecord {
  /** Hash SHA-256 del token. El token en claro solo vive en la cookie. */
  tokenHash: string
  userId: string
  createdAt: string
  expiresAt: string
}

export interface ListRecord {
  id: string
  name: string
  ownerId: string
  inviteCode: string
  memberIds: string[]
  createdAt: string
}

export interface TaskRecord {
  listId: string
  task: Task
  updatedAt: string
  /** Lápida: permite propagar eliminaciones a otros dispositivos. */
  deleted: boolean
}

export interface Database {
  schemaVersion: number
  users: UserRecord[]
  sessions: SessionRecord[]
  lists: ListRecord[]
  tasks: TaskRecord[]
}

export interface PublicUser {
  id: string
  name: string
  email: string
  createdAt: string
}

export interface ListMemberSummary {
  id: string
  name: string
}

export interface ListSummary {
  id: string
  name: string
  ownerId: string
  createdAt: string
  memberCount: number
  members: ListMemberSummary[]
  inviteCode: string
  role: 'owner' | 'member'
}

export interface TaskChange {
  task: Task
  updatedAt: string
  deleted: boolean
}

export interface RejectedTask {
  id: string | null
  error: string
}
