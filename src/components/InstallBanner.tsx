import {
  IconDownload,
  IconPlus,
  IconShare,
  IconSmartphone,
  IconX,
} from './Icons'

interface InstallBannerProps {
  canInstall: boolean
  installed: boolean
  isIos: boolean
  dismissed: boolean
  onInstall: () => Promise<boolean>
  onDismiss: () => void
}

/**
 * Aviso para instalar la PWA. En Android y escritorio se apoya en el diálogo
 * nativo del navegador; en iOS, donde no existe `beforeinstallprompt`, muestra
 * los pasos de Safari.
 */
export function InstallBanner({
  canInstall,
  installed,
  isIos,
  dismissed,
  onInstall,
  onDismiss,
}: InstallBannerProps) {
  if (installed || dismissed || (!canInstall && !isIos)) {
    return null
  }

  return (
    <aside className="install-banner" aria-label="Instalar DíaLista">
      <span className="install-banner__icon" aria-hidden="true">
        <IconSmartphone />
      </span>

      <div className="install-banner__copy">
        <p className="install-banner__eyebrow">Aplicación</p>
        <p className="install-banner__title">Lleva DíaLista en tu móvil</p>
        <p className="install-banner__text">
          {canInstall
            ? 'Instálala para abrirla a pantalla completa, con su icono propio y la última copia de tus tareas disponible sin conexión.'
            : 'En iPhone o iPad, abre DíaLista en Safari y añádela a la pantalla de inicio.'}
        </p>
        {!canInstall && isIos && (
          <p className="install-banner__steps">
            <IconShare aria-hidden="true" />
            Compartir
            <span aria-hidden="true">→</span>
            <IconPlus aria-hidden="true" />
            Añadir a pantalla de inicio
          </p>
        )}
      </div>

      <div className="install-banner__actions">
        {canInstall && (
          <button
            type="button"
            className="button button--primary button--compact"
            onClick={() => {
              void onInstall()
            }}
          >
            <IconDownload />
            Instalar
          </button>
        )}
        <button
          type="button"
          className="install-banner__close"
          aria-label="Descartar aviso de instalación"
          onClick={onDismiss}
        >
          <IconX />
        </button>
      </div>
    </aside>
  )
}
