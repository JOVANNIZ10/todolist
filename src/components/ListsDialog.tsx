import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { SYNC_STATUS_LABELS } from '../lib/labels'
import type { AuthUser, SyncStatus, TaskList } from '../types'
import {
  IconCheck,
  IconCopy,
  IconLink,
  IconLogOut,
  IconPlus,
  IconUsers,
  IconX,
} from './Icons'

interface ListsDialogProps {
  user: AuthUser
  lists: TaskList[]
  activeListId: string | null
  syncStatus: SyncStatus
  busy: boolean
  onSelectList: (listId: string) => void
  onJoinList: (code: string) => Promise<TaskList>
  onCreateList: (name: string) => Promise<TaskList>
  onLeaveList: (listId: string) => Promise<void>
  onLogout: () => Promise<void>
  onClose: () => void
}

interface Feedback {
  tone: 'ok' | 'error'
  text: string
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function ListsDialog({
  user,
  lists,
  activeListId,
  syncStatus,
  busy,
  onSelectList,
  onJoinList,
  onCreateList,
  onLeaveList,
  onLogout,
  onClose,
}: ListsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [joinCode, setJoinCode] = useState('')
  const [newListName, setNewListName] = useState('')
  const [joining, setJoining] = useState(false)
  const [creating, setCreating] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [confirmLeaveId, setConfirmLeaveId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [copied, setCopied] = useState(false)

  const activeList =
    lists.find((list) => list.id === activeListId) ?? lists[0] ?? null
  const confirmLeave =
    activeList !== null && confirmLeaveId === activeList.id

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    document.body.classList.add('modal-open')

    return () => {
      document.body.classList.remove('modal-open')
      if (dialog?.open) dialog.close()
    }
  }, [])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2200)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copyInviteCode = async () => {
    if (!activeList) return

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(activeList.inviteCode)
      } else {
        throw new Error('Sin acceso al portapapeles')
      }
      setCopied(true)
      setFeedback(null)
    } catch {
      setFeedback({
        tone: 'error',
        text: `No se ha podido copiar. El código es ${activeList.inviteCode}.`,
      })
    }
  }

  const handleJoin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (code.length < 6) {
      setFeedback({
        tone: 'error',
        text: 'Escribe el código de invitación completo.',
      })
      return
    }

    setJoining(true)
    setFeedback(null)
    try {
      const list = await onJoinList(code)
      setJoinCode('')
      setFeedback({
        tone: 'ok',
        text: `Te has unido a «${list.name}».`,
      })
      onSelectList(list.id)
      onClose()
    } catch (error) {
      setFeedback({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se ha podido unir a la lista.',
      })
    } finally {
      setJoining(false)
    }
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newListName.trim()
    if (!name) {
      setFeedback({
        tone: 'error',
        text: 'Ponle un nombre a la lista.',
      })
      return
    }

    setCreating(true)
    setFeedback(null)
    try {
      const list = await onCreateList(name)
      setNewListName('')
      setFeedback({
        tone: 'ok',
        text: `Lista «${list.name}» creada.`,
      })
      onSelectList(list.id)
      onClose()
    } catch (error) {
      setFeedback({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se ha podido crear la lista.',
      })
    } finally {
      setCreating(false)
    }
  }

  const handleLeave = async () => {
    if (!activeList) return

    if (!confirmLeave) {
      setConfirmLeaveId(activeList.id)
      return
    }

    setLeaving(true)
    setFeedback(null)
    try {
      await onLeaveList(activeList.id)
      setConfirmLeaveId(null)
      setFeedback({
        tone: 'ok',
        text: 'Has salido de la lista. Las tareas siguen disponibles para la otra persona.',
      })
    } catch (error) {
      setFeedback({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'No se ha podido salir de la lista.',
      })
    } finally {
      setLeaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog modal-dialog--wide"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-card lists-card">
        <header className="modal-card__header">
          <div>
            <p className="modal-card__eyebrow">Cuenta de {user.name}</p>
            <h2 id={titleId}>Listas y personas</h2>
          </div>
          <button
            type="button"
            className="icon-action icon-action--large"
            aria-label="Cerrar listas"
            onClick={onClose}
          >
            <IconX />
          </button>
        </header>

        <div className="settings-sections">
          <section className="settings-section">
            <div className="settings-section__heading">
              <h3>Tus listas</h3>
              <p>
                Cambia de lista para ver sus tareas. Cada lista admite como
                máximo dos personas.
              </p>
            </div>

            <ul className="lists-list">
              {lists.map((list) => {
                const isActive = list.id === activeList?.id
                return (
                  <li key={list.id}>
                    <button
                      type="button"
                      className={`list-row${isActive ? ' is-active' : ''}`}
                      aria-current={isActive ? 'true' : undefined}
                      onClick={() => {
                        onSelectList(list.id)
                        onClose()
                      }}
                    >
                      <span className="list-row__icon" aria-hidden="true">
                        {isActive ? <IconCheck /> : <IconUsers />}
                      </span>
                      <span className="list-row__copy">
                        <strong>{list.name}</strong>
                        <small>
                          {list.memberCount === 2
                            ? 'Compartida por 2 personas'
                            : list.role === 'owner'
                              ? 'Solo para ti · creada por ti'
                              : 'Solo para ti'}
                        </small>
                      </span>
                      <span className="list-row__count">
                        {list.memberCount}/2
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          {activeList && (
            <section className="settings-section">
              <div className="settings-section__heading">
                <h3>Compartir «{activeList.name}»</h3>
                <p>
                  Envía este código a la otra persona para que se una a la
                  lista. Solo puede haber dos miembros.
                </p>
              </div>

              <div className="invite-box">
                <div>
                  <span className="invite-box__label">
                    Código de invitación
                  </span>
                  <strong>{activeList.inviteCode}</strong>
                </div>
                <button
                  type="button"
                  className="button button--secondary button--compact"
                  onClick={() => void copyInviteCode()}
                >
                  {copied ? <IconCheck /> : <IconCopy />}
                  {copied ? 'Copiado' : 'Copiar código'}
                </button>
              </div>

              <div className="member-chips">
                {activeList.members.map((member) => (
                  <span className="member-chip" key={member.id}>
                    <span className="member-chip__avatar" aria-hidden="true">
                      {initials(member.name) || '?'}
                    </span>
                    {member.name}
                    {member.id === user.id ? ' (tú)' : ''}
                  </span>
                ))}
                {activeList.memberCount < 2 && (
                  <span className="member-chip member-chip--empty">
                    <span className="member-chip__avatar" aria-hidden="true">
                      +
                    </span>
                    Esperando a la otra persona
                  </span>
                )}
              </div>
            </section>
          )}

          <section className="settings-section">
            <div className="settings-section__heading">
              <h3>Unirse a una lista</h3>
              <p>
                Introduce el código de ocho caracteres que te haya compartido
                la otra persona.
              </p>
            </div>
            <form className="inline-form" onSubmit={handleJoin}>
              <label className="sr-only" htmlFor="join-list-code">
                Código de invitación
              </label>
              <input
                id="join-list-code"
                type="text"
                value={joinCode}
                maxLength={12}
                autoComplete="off"
                spellCheck={false}
                placeholder="Código, por ejemplo ABC23DEF"
                onChange={(event) => setJoinCode(event.target.value)}
              />
              <button
                type="submit"
                className="button button--secondary button--compact"
                disabled={joining || busy}
              >
                <IconLink />
                {joining ? 'Uniéndome…' : 'Unirse'}
              </button>
            </form>
          </section>

          <section className="settings-section">
            <div className="settings-section__heading">
              <h3>Crear otra lista</h3>
              <p>
                Útil para separar proyectos o empezar una lista nueva con otra
                persona.
              </p>
            </div>
            <form className="inline-form" onSubmit={handleCreate}>
              <label className="sr-only" htmlFor="new-list-name">
                Nombre de la lista
              </label>
              <input
                id="new-list-name"
                type="text"
                value={newListName}
                maxLength={80}
                placeholder="Nombre de la lista"
                onChange={(event) => setNewListName(event.target.value)}
              />
              <button
                type="submit"
                className="button button--ghost button--compact"
                disabled={creating || busy}
              >
                <IconPlus />
                {creating ? 'Creando…' : 'Crear lista'}
              </button>
            </form>
          </section>

          {activeList && (
            <section className="settings-section">
              <div className="settings-section__heading">
                <h3>Salir de la lista</h3>
                <p>
                  Dejarás de ver «{activeList.name}» en tu cuenta. La otra
                  persona conservará las tareas y la lista.
                </p>
              </div>
              <div className="settings-data-actions">
                <button
                  type="button"
                  className="button button--ghost button--compact lists-leave"
                  disabled={leaving}
                  onClick={() => void handleLeave()}
                >
                  {leaving
                    ? 'Saliendo…'
                    : confirmLeave
                      ? '¿Confirmar salida?'
                      : 'Salir de esta lista'}
                </button>
                {confirmLeave && (
                  <button
                    type="button"
                    className="text-action"
                    onClick={() => setConfirmLeaveId(null)}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </section>
          )}
        </div>

        {feedback && (
          <p
            className={`settings-feedback${
              feedback.tone === 'error' ? ' settings-feedback--error' : ''
            }`}
            role={feedback.tone === 'error' ? 'alert' : 'status'}
          >
            {feedback.tone === 'ok' && <IconCheck />}
            {feedback.text}
          </p>
        )}

        <footer className="modal-card__footer lists-footer">
          <div className="lists-footer__account">
            <span>Sesión iniciada como</span>
            <strong>{user.email}</strong>
            <small>{SYNC_STATUS_LABELS[syncStatus]}</small>
          </div>
          <button
            type="button"
            className="button button--ghost button--compact"
            disabled={busy}
            onClick={() => void onLogout()}
          >
            <IconLogOut />
            Cerrar sesión
          </button>
          <button
            type="button"
            className="button button--primary button--compact"
            onClick={onClose}
          >
            Hecho
          </button>
        </footer>
      </div>
    </dialog>
  )
}
