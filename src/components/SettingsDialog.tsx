import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import {
  SORT_MODE_LABELS,
  SYNC_STATUS_LABELS,
  THEME_LABELS,
} from '../lib/labels'
import type { PwaInstallState } from '../hooks/usePwaInstall'
import type {
  AppSettings,
  AuthUser,
  SyncStatus,
  TaskSortMode,
  ThemePreference,
} from '../types'
import {
  IconCheck,
  IconCloud,
  IconDownload,
  IconMoon,
  IconPlus,
  IconSettings,
  IconShare,
  IconSun,
  IconUpload,
  IconUser,
  IconX,
} from './Icons'

type NotificationPermissionState = NotificationPermission | 'unsupported'

interface SettingsDialogProps {
  settings: AppSettings
  notificationPermission: NotificationPermissionState
  taskCount: number
  authStatus: 'guest' | 'authenticated'
  user: AuthUser | null
  activeListName: string | null
  syncStatus: SyncStatus
  localTaskCount: number
  pwaInstall: PwaInstallState
  onUpdateSettings: (changes: Partial<AppSettings>) => void
  onEnableNotifications: () => Promise<void>
  onExport: () => void
  onImportFile: (file: File) => Promise<string>
  onOpenAuth: () => void
  onOpenLists: () => void
  onLogout: () => void
  onMigrateLocal: () => void
  onClose: () => void
}

const THEME_OPTIONS: Array<{
  value: ThemePreference
  label: string
  Icon: typeof IconSun
}> = [
  { value: 'light', label: THEME_LABELS.light, Icon: IconSun },
  { value: 'dark', label: THEME_LABELS.dark, Icon: IconMoon },
  { value: 'system', label: THEME_LABELS.system, Icon: IconSettings },
]

const SORT_OPTIONS: Array<{ value: TaskSortMode; label: string }> = [
  { value: 'time', label: SORT_MODE_LABELS.time },
  { value: 'manual', label: SORT_MODE_LABELS.manual },
]

export function SettingsDialog({
  settings,
  notificationPermission,
  taskCount,
  authStatus,
  user,
  activeListName,
  syncStatus,
  localTaskCount,
  pwaInstall,
  onUpdateSettings,
  onEnableNotifications,
  onExport,
  onImportFile,
  onOpenAuth,
  onOpenLists,
  onLogout,
  onMigrateLocal,
  onClose,
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
    }

    document.body.classList.add('modal-open')

    return () => {
      document.body.classList.remove('modal-open')
      if (dialog?.open) {
        dialog.close()
      }
    }
  }, [])

  const notificationsEnabled =
    settings.browserNotifications &&
    notificationPermission === 'granted'
  const notificationsBlocked = notificationPermission === 'denied'
  const notificationsUnsupported = notificationPermission === 'unsupported'

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setImporting(true)
    setImportError(null)
    setImportMessage(null)

    try {
      const message = await onImportFile(file)
      setImportMessage(message)
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : 'No se ha podido importar la copia.',
      )
    } finally {
      setImporting(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog modal-dialog--settings"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="modal-card settings-card">
        <header className="modal-card__header">
          <div>
            <p className="modal-card__eyebrow">Personaliza DíaLista</p>
            <h2 id={titleId}>Ajustes</h2>
          </div>
          <button
            type="button"
            className="icon-action icon-action--large"
            aria-label="Cerrar ajustes"
            onClick={onClose}
          >
            <IconX />
          </button>
        </header>

        <div className="settings-sections">
          <section className="settings-section">
            <div className="settings-section__heading">
              <h3>Cuenta y sincronización</h3>
              {authStatus === 'authenticated' ? (
                <p>
                  Conectado como <strong>{user?.email}</strong>. Lista activa:{' '}
                  <strong>{activeListName ?? 'sin lista'}</strong>.
                </p>
              ) : (
                <p>
                  Ahora mismo tus tareas se guardan solo en este navegador.
                  Crea una cuenta para sincronizarlas entre dispositivos y
                  compartir una lista con otra persona.
                </p>
              )}
            </div>

            {authStatus === 'authenticated' ? (
              <>
                <p className={`sync-state sync-state--${syncStatus}`}>
                  <span
                    className={`sync-dot sync-dot--${syncStatus}`}
                    aria-hidden="true"
                  />
                  {SYNC_STATUS_LABELS[syncStatus]}
                </p>
                <div className="settings-data-actions">
                  <button
                    type="button"
                    className="button button--secondary button--compact"
                    onClick={onOpenLists}
                  >
                    <IconCloud />
                    Gestionar listas
                  </button>
                  {localTaskCount > 0 && (
                    <button
                      type="button"
                      className="button button--ghost button--compact"
                      onClick={onMigrateLocal}
                    >
                      <IconUser />
                      Copiar {localTaskCount} tarea
                      {localTaskCount === 1 ? '' : 's'} local
                      {localTaskCount === 1 ? '' : 'es'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="button button--ghost button--compact"
                    onClick={onLogout}
                  >
                    Cerrar sesión
                  </button>
                </div>
                {localTaskCount > 0 && (
                  <p className="settings-note">
                    La copia combina las tareas por identificador y no borra
                    las que ya haya en la lista. Tus datos locales se conservan
                    por si vuelves a usar el modo sin cuenta.
                  </p>
                )}
                <p className="settings-note">
                  En una lista compartida, los recordatorios son únicos: el
                  primer dispositivo que avisa lo marca para ambos.
                </p>
              </>
            ) : (
              <div className="settings-data-actions">
                <button
                  type="button"
                  className="button button--secondary button--compact"
                  onClick={onOpenAuth}
                >
                  <IconUser />
                  Entrar o crear cuenta
                </button>
              </div>
            )}
          </section>

          <section className="settings-section">
            <div className="settings-section__heading">
              <h3>Apariencia</h3>
              <p>Elige cómo quieres ver la aplicación.</p>
            </div>
            <div
              className="settings-segmented"
              role="group"
              aria-label="Tema de la aplicación"
            >
              {THEME_OPTIONS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={`settings-option${
                    settings.theme === value ? ' is-active' : ''
                  }`}
                  aria-pressed={settings.theme === value}
                  onClick={() => onUpdateSettings({ theme: value })}
                >
                  <Icon />
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section__heading">
              <h3>Orden de las tareas</h3>
              <p>
                El orden manual permite arrastrar las tarjetas y usar las
                flechas.
              </p>
            </div>
            <div
              className="settings-segmented"
              role="group"
              aria-label="Orden de las tareas"
            >
              {SORT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`settings-option${
                    settings.sortMode === value ? ' is-active' : ''
                  }`}
                  aria-pressed={settings.sortMode === value}
                  onClick={() => onUpdateSettings({ sortMode: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section__heading">
              <h3>Recordatorios</h3>
              <p>
                Los avisos aparecen dentro de la app. Si activas las
                notificaciones del navegador, también se muestran al cambiar de
                pestaña. La app debe seguir abierta para enviarlos.
              </p>
            </div>
            <label
              className={`settings-toggle${
                notificationsBlocked || notificationsUnsupported
                  ? ' settings-toggle--disabled'
                  : ''
              }`}
            >
              <input
                type="checkbox"
                checked={notificationsEnabled}
                disabled={notificationsBlocked || notificationsUnsupported}
                onChange={() => {
                  if (notificationsEnabled) {
                    onUpdateSettings({ browserNotifications: false })
                  } else {
                    void onEnableNotifications()
                  }
                }}
              />
              <span className="settings-toggle__track" aria-hidden="true">
                <span className="settings-toggle__thumb" />
              </span>
              <span>
                <strong>Notificaciones del navegador</strong>
                <small>
                  {notificationsUnsupported
                    ? 'Este navegador no permite notificaciones.'
                    : notificationsBlocked
                      ? 'Están bloqueadas en los ajustes del navegador.'
                      : notificationPermission === 'granted'
                        ? 'Permiso concedido.'
                        : 'Se pedirá permiso al activarlas.'}
                </small>
              </span>
            </label>
          </section>

          <section className="settings-section">
            <div className="settings-section__heading">
              <h3>Aplicación</h3>
              <p>
                {pwaInstall.installed
                  ? 'DíaLista está abierta como aplicación instalada. Se actualiza automáticamente al abrirla con conexión.'
                  : pwaInstall.canInstall
                    ? 'Instala DíaLista para abrirla a pantalla completa, con su propio icono y acceso directo.'
                    : pwaInstall.isIos
                      ? 'En iPhone o iPad, Safari permite añadir la web a la pantalla de inicio en dos pasos.'
                      : 'Puedes instalarla desde el menú del navegador. Busca «Instalar aplicación» o «Añadir a pantalla de inicio».'}
              </p>
            </div>

            {pwaInstall.installed ? (
              <p className="settings-feedback">
                <IconCheck />
                Instalada en este dispositivo
              </p>
            ) : pwaInstall.canInstall ? (
              <div className="settings-data-actions">
                <button
                  type="button"
                  className="button button--secondary button--compact"
                  onClick={() => {
                    void pwaInstall.install()
                  }}
                >
                  <IconDownload />
                  Instalar DíaLista
                </button>
              </div>
            ) : pwaInstall.isIos ? (
              <ol className="settings-install-steps">
                <li>
                  <span className="settings-install-steps__icon">
                    <IconShare />
                  </span>
                  Abre esta página en Safari y pulsa el botón Compartir.
                </li>
                <li>
                  <span className="settings-install-steps__icon">
                    <IconPlus />
                  </span>
                  Elige «Añadir a pantalla de inicio» y confirma.
                </li>
              </ol>
            ) : (
              <p className="settings-note">
                Si no ves la opción, usa Chrome, Edge o Safari actualizado y
                abre DíaLista desde una dirección HTTPS.
              </p>
            )}

            <p className="settings-note">
              La última copia de tus tareas se guarda en este dispositivo para
              consultarla sin conexión. Los cambios pendientes se sincronizan
              cuando vuelve la conexión.
            </p>
          </section>

          <section className="settings-section">
            <div className="settings-section__heading">
              <h3>Datos y copias de seguridad</h3>
              <p>
                {authStatus === 'authenticated'
                  ? `Tienes ${taskCount} tarea${taskCount === 1 ? '' : 's'} en «${activeListName ?? 'tu lista'}».`
                  : `Tienes ${taskCount} tarea${taskCount === 1 ? '' : 's'} guardada${taskCount === 1 ? '' : 's'} solo en este navegador.`}
              </p>
            </div>
            <div className="settings-data-actions">
              <button
                type="button"
                className="button button--secondary button--compact"
                onClick={onExport}
              >
                <IconDownload />
                Exportar copia
              </button>
              <button
                type="button"
                className="button button--ghost button--compact"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                <IconUpload />
                {importing ? 'Importando…' : 'Importar copia'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={handleImport}
              />
            </div>
            <p className="settings-note">
              La importación combina las tareas por identificador: no borra las
              que ya tienes.
              {authStatus === 'authenticated'
                ? ' Las tareas importadas se sincronizan con la lista activa.'
                : ' Las copias se guardan en formato JSON.'}
            </p>
            {importMessage && (
              <p className="settings-feedback" role="status">
                <IconCheck />
                {importMessage}
              </p>
            )}
            {importError && (
              <p className="settings-feedback settings-feedback--error" role="alert">
                {importError}
              </p>
            )}
          </section>
        </div>

        <footer className="modal-card__footer">
          <button
            type="button"
            className="button button--primary"
            onClick={onClose}
          >
            Hecho
          </button>
        </footer>
      </div>
    </dialog>
  )
}
