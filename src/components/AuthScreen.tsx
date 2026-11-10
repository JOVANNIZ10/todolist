import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import type { LoginInput, RegistrationInput } from '../data/apiClient'
import {
  IconCheck,
  IconCloud,
  IconLock,
  IconUser,
  IconUsers,
  IconX,
} from './Icons'

type AuthMode = 'login' | 'register'

interface AuthScreenProps {
  error: string | null
  busy: boolean
  onLogin: (input: LoginInput) => Promise<void>
  onRegister: (input: RegistrationInput) => Promise<void>
  onClose: () => void
}

const HIGHLIGHTS = [
  {
    Icon: IconCloud,
    title: 'Sincroniza entre dispositivos',
    text: 'Tus tareas viajan contigo al iniciar sesión.',
  },
  {
    Icon: IconUsers,
    title: 'Comparte una lista',
    text: 'Invita a otra persona con un código y organizadlo todo juntos.',
  },
  {
    Icon: IconCheck,
    title: 'Sin perder lo local',
    text: 'Puedes copiar tus tareas actuales a la cuenta cuando quieras.',
  },
] as const

export function AuthScreen({
  error,
  busy,
  onLogin,
  onRegister,
  onClose,
}: AuthScreenProps) {
  const titleId = useId()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [])

  useEffect(() => {
    if (mode === 'register') nameInputRef.current?.focus()
    else emailInputRef.current?.focus()
  }, [mode])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [busy, onClose])

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setFormError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const cleanEmail = email.trim()
    if (!cleanEmail) {
      setFormError('Escribe tu correo electrónico.')
      return
    }
    if (!password) {
      setFormError('Escribe tu contraseña.')
      return
    }
    if (mode === 'register' && name.trim().length === 0) {
      setFormError('Escribe tu nombre.')
      return
    }
    if (mode === 'register' && password.length < 8) {
      setFormError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    try {
      if (mode === 'register') {
        await onRegister({
          name: name.trim(),
          email: cleanEmail,
          password,
        })
      } else {
        await onLogin({ email: cleanEmail, password })
      }
      onClose()
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : 'No se ha podido completar la operación.',
      )
    }
  }

  const message = formError ?? error

  return (
    <div
      className="auth-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div className="auth-card">
        <section className="auth-card__aside" aria-label="Ventajas de la cuenta">
          <div className="auth-brand">
            <span className="auth-brand__mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="26" height="26" fill="none">
                <path
                  d="M9 16.5 14 21 23.5 10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div>
              <p className="auth-brand__name">DíaLista</p>
              <p className="auth-brand__tagline">Tu día, en orden.</p>
            </div>
          </div>

          <div className="auth-aside__copy">
            <h2>Vuestra lista, siempre al día.</h2>
            <p>
              Crea una cuenta para sincronizar tus tareas o comparte una
              lista con otra persona. El modo local sigue disponible.
            </p>
          </div>

          <ul className="auth-highlights">
            {HIGHLIGHTS.map(({ Icon, title, text }) => (
              <li key={title}>
                <span className="auth-highlights__icon" aria-hidden="true">
                  <Icon />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="auth-card__main">
          <button
            type="button"
            className="icon-action icon-action--large auth-close"
            aria-label="Cerrar y continuar en modo local"
            onClick={onClose}
          >
            <IconX />
          </button>

          <div className="auth-main__heading">
            <p className="modal-card__eyebrow">
              {mode === 'login' ? 'Bienvenido de nuevo' : 'Empieza ahora'}
            </p>
            <h2 id={titleId}>
              {mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}
            </h2>
            <p>
              {mode === 'login'
                ? 'Accede para recuperar tus listas y sincronizar los cambios.'
                : 'Solo necesitas un nombre, un correo y una contraseña.'}
            </p>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Acceso">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'is-active' : ''}
              onClick={() => switchMode('login')}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'is-active' : ''}
              onClick={() => switchMode('register')}
            >
              Crear cuenta
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {mode === 'register' && (
              <label className="auth-field">
                <span>Nombre</span>
                <span className="auth-field__control">
                  <IconUser />
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={name}
                    maxLength={60}
                    autoComplete="name"
                    placeholder="Cómo te llamas"
                    onChange={(event) => setName(event.target.value)}
                  />
                </span>
              </label>
            )}

            <label className="auth-field">
              <span>Correo electrónico</span>
              <span className="auth-field__control">
                <IconUser />
                <input
                  ref={emailInputRef}
                  type="email"
                  value={email}
                  maxLength={254}
                  autoComplete="email"
                  inputMode="email"
                  placeholder="tu@correo.com"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </span>
            </label>

            <label className="auth-field">
              <span>Contraseña</span>
              <span className="auth-field__control">
                <IconLock />
                <input
                  type="password"
                  value={password}
                  maxLength={200}
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  placeholder={
                    mode === 'login'
                      ? 'Tu contraseña'
                      : '8 caracteres como mínimo'
                  }
                  onChange={(event) => setPassword(event.target.value)}
                />
              </span>
            </label>

            {message && (
              <p className="form-error auth-error" role="alert">
                {message}
              </p>
            )}

            <button
              type="submit"
              className="button button--primary auth-submit"
              disabled={busy}
            >
              {busy
                ? 'Conectando…'
                : mode === 'login'
                  ? 'Entrar'
                  : 'Crear cuenta'}
            </button>
          </form>

          <div className="auth-local">
            <p>
              ¿Prefieres no crear una cuenta? Tus tareas pueden seguir
              guardándose solo en este dispositivo.
            </p>
            <button type="button" className="text-action" onClick={onClose}>
              Continuar en modo local
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
