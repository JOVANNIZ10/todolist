import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
}

const DISMISS_KEY = 'dialista:install-dismissed'

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  )
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false

  const userAgent = navigator.userAgent
  const iPadDesktopMode =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1

  return /iPad|iPhone|iPod/i.test(userAgent) || iPadDesktopMode
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function saveDismissed(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // Solo es una preferencia visual.
  }
}

export interface PwaInstallState {
  canInstall: boolean
  installed: boolean
  isIos: boolean
  dismissed: boolean
  install: () => Promise<boolean>
  dismiss: () => void
}

/**
 * Recoge el evento de instalación del navegador. En iOS no existe
 * `beforeinstallprompt`, así que la interfaz muestra las instrucciones de
 * Safari en su lugar.
 */
export function usePwaInstall(): PwaInstallState {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)
  const [isIos] = useState(isIosDevice)
  const [dismissed, setDismissed] = useState(readDismissed)

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    const handleInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
    }
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const handleDisplayMode = () => setInstalled(isStandalone())

    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('appinstalled', handleInstalled)
    displayMode.addEventListener('change', handleDisplayMode)

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('appinstalled', handleInstalled)
      displayMode.removeEventListener('change', handleDisplayMode)
    }
  }, [])

  const install = useCallback(async () => {
    if (!promptEvent) return false

    try {
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      setPromptEvent(null)
      return choice.outcome === 'accepted'
    } catch {
      setPromptEvent(null)
      return false
    }
  }, [promptEvent])

  const dismiss = useCallback(() => {
    saveDismissed()
    setDismissed(true)
  }, [])

  return {
    canInstall: promptEvent !== null,
    installed,
    isIos,
    dismissed,
    install,
    dismiss,
  }
}
