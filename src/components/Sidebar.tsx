import type { ComponentType } from 'react'
import { isValidDateKey } from '../domain/dates'
import { SYNC_STATUS_LABELS } from '../lib/labels'
import type {
  MainViewKey,
  NavigationCounts,
  SyncStatus,
  ViewKey,
} from '../types'
import {
  IconAlert,
  IconCalendar,
  IconCalendarRange,
  IconChartBar,
  IconCheckList,
  IconChevronRight,
  IconInbox,
  IconMoon,
  IconSettings,
  IconSun,
  type IconProps,
} from './Icons'

interface NavigationItem {
  view: MainViewKey
  label: string
  Icon: ComponentType<IconProps>
}

const NAVIGATION_ITEMS: NavigationItem[] = [
  { view: 'today', label: 'Hoy', Icon: IconSun },
  { view: 'tomorrow', label: 'Mañana', Icon: IconCalendar },
  { view: 'week', label: 'Esta semana', Icon: IconCalendarRange },
  { view: 'overdue', label: 'Atrasadas', Icon: IconAlert },
  { view: 'unscheduled', label: 'Sin fecha', Icon: IconInbox },
]

interface SidebarProps {
  view: ViewKey
  selectedDate: string | null
  counts: NavigationCounts
  resolvedTheme: 'light' | 'dark'
  authenticated: boolean
  userName: string | null
  activeListName: string | null
  listMemberCount: number | null
  syncStatus: SyncStatus
  onSelectView: (view: MainViewKey) => void
  onSelectDate: (date: string) => void
  onOpenStatistics: () => void
  onOpenSettings: () => void
  onToggleTheme: () => void
  onOpenAccount: () => void
  onOpenLists: () => void
}

export function Sidebar({
  view,
  selectedDate,
  counts,
  resolvedTheme,
  authenticated,
  userName,
  activeListName,
  listMemberCount,
  syncStatus,
  onSelectView,
  onSelectDate,
  onOpenStatistics,
  onOpenSettings,
  onToggleTheme,
  onOpenAccount,
  onOpenLists,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand__mark" aria-hidden="true">
          <svg
            viewBox="0 0 32 32"
            width="24"
            height="24"
            fill="none"
            focusable="false"
          >
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
          <p className="brand__name">DíaLista</p>
          <p className="brand__tagline">Tu día, en orden.</p>
        </div>
      </div>

      <button
        type="button"
        className="list-switcher"
        onClick={authenticated ? onOpenLists : onOpenAccount}
      >
        <span className="list-switcher__icon" aria-hidden="true">
          <IconCheckList />
        </span>
        <span className="list-switcher__copy">
          <small>{authenticated ? 'Lista activa' : 'Modo local'}</small>
          <strong>
            {authenticated ? (activeListName ?? 'Sin lista') : 'Sin cuenta'}
          </strong>
          <span>
            {authenticated
              ? listMemberCount === 2
                ? 'Compartida por 2 personas'
                : 'Solo para ti'
              : 'Toca para entrar o crear cuenta'}
          </span>
        </span>
        <IconChevronRight className="list-switcher__chevron" />
      </button>

      <nav className="main-nav" aria-label="Vistas principales">
        <p className="sidebar__label">Vistas</p>
        <ul>
          {NAVIGATION_ITEMS.map(({ view: itemView, label, Icon }) => {
            const isActive = view === itemView
            const count = counts[itemView]
            const isOverdue = itemView === 'overdue'

            return (
              <li key={itemView}>
                <button
                  type="button"
                  className={`nav-item${isActive ? ' nav-item--active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onSelectView(itemView)}
                >
                  <Icon className="nav-item__icon" />
                  <span>{label}</span>
                  {count > 0 && (
                    <span
                      className={`nav-item__badge${
                        isOverdue ? ' nav-item__badge--overdue' : ''
                      }`}
                      aria-label={`${count} tareas activas`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="sidebar-tools" aria-label="Herramientas">
        <button
          type="button"
          className="sidebar-tool"
          onClick={onOpenStatistics}
        >
          <IconChartBar />
          <span>Estadísticas</span>
        </button>
        <button
          type="button"
          className="sidebar-tool"
          onClick={onOpenSettings}
        >
          <IconSettings />
          <span>Ajustes</span>
        </button>
        <button
          type="button"
          className="sidebar-tool"
          aria-label={
            resolvedTheme === 'dark'
              ? 'Cambiar a tema claro'
              : 'Cambiar a tema oscuro'
          }
          onClick={onToggleTheme}
        >
          {resolvedTheme === 'dark' ? <IconSun /> : <IconMoon />}
          <span>
            {resolvedTheme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </span>
        </button>
      </div>

      <div className="date-jump">
        <label htmlFor="date-jump-input">
          <IconCalendar className="date-jump__icon" />
          Ir a un día
        </label>
        <input
          id="date-jump-input"
          type="date"
          value={view === 'day' ? (selectedDate ?? '') : ''}
          onChange={(event) => {
            if (isValidDateKey(event.target.value)) {
              onSelectDate(event.target.value)
            }
          }}
        />
        {view === 'day' && (
          <button
            type="button"
            className="date-jump__today"
            onClick={() => onSelectView('today')}
          >
            Volver a hoy
          </button>
        )}
      </div>

      <button
        type="button"
        className="sidebar__footer sidebar__footer--button"
        onClick={authenticated ? onOpenLists : onOpenAccount}
      >
        <span
          className={`sync-dot sync-dot--${syncStatus}`}
          aria-hidden="true"
        />
        <span>
          {authenticated
            ? `${userName ?? 'Tu cuenta'} · ${SYNC_STATUS_LABELS[syncStatus]}`
            : 'Datos guardados solo en este dispositivo'}
        </span>
      </button>
    </aside>
  )
}
