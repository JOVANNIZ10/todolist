import { useCallback, useEffect, useState } from 'react'
import {
  applyTheme,
  loadSettings,
  saveSettings,
  systemPrefersDark,
} from '../data/settingsRepository'
import type { AppSettings } from '../types'

export interface UseSettingsResult {
  settings: AppSettings
  resolvedTheme: 'light' | 'dark'
  updateSettings: (changes: Partial<AppSettings>) => void
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemDark(event.matches)
    }

    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    applyTheme(settings.theme)
  }, [settings.theme, systemDark])

  const updateSettings = useCallback((changes: Partial<AppSettings>) => {
    setSettings((current) => ({ ...current, ...changes }))
  }, [])

  const resolvedTheme =
    settings.theme === 'system'
      ? systemDark
        ? 'dark'
        : 'light'
      : settings.theme

  return { settings, resolvedTheme, updateSettings }
}
