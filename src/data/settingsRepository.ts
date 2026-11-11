import type {
  AppSettings,
  TaskSortMode,
  ThemePreference,
} from '../types'

const SETTINGS_KEY = 'dialista:settings'
const THEME_COLORS = {
  light: '#1c2b24',
  dark: '#0d1510',
} as const

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  sortMode: 'time',
  browserNotifications: false,
}

function getBrowserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isTheme(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

function isSortMode(value: unknown): value is TaskSortMode {
  return value === 'time' || value === 'manual'
}

export function loadSettings(
  storage: Storage | null = getBrowserStorage(),
): AppSettings {
  if (!storage) return { ...DEFAULT_SETTINGS }

  try {
    const raw = storage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return { ...DEFAULT_SETTINGS }
    }

    const value = parsed as Record<string, unknown>
    return {
      theme: isTheme(value.theme) ? value.theme : DEFAULT_SETTINGS.theme,
      sortMode: isSortMode(value.sortMode)
        ? value.sortMode
        : DEFAULT_SETTINGS.sortMode,
      browserNotifications: value.browserNotifications === true,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(
  settings: AppSettings,
  storage: Storage | null = getBrowserStorage(),
): boolean {
  if (!storage) return false

  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') {
    return systemPrefersDark() ? 'dark' : 'light'
  }

  return preference
}

export function applyTheme(preference: ThemePreference): void {
  if (typeof document === 'undefined') return

  const resolved = resolveTheme(preference)
  const root = document.documentElement
  root.dataset.theme = resolved
  root.style.colorScheme = resolved

  const themeColor = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )
  if (themeColor) {
    themeColor.content = THEME_COLORS[resolved]
  }
}

export function applyStoredTheme(): void {
  applyTheme(loadSettings().theme)
}

export const SETTINGS_STORAGE_KEY = SETTINGS_KEY
