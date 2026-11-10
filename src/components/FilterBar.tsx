import {
  PRIORITY_FILTER_LABELS,
  STATUS_FILTER_LABELS,
} from '../lib/labels'
import type {
  PriorityFilter,
  StatusFilter,
  TaskFilters,
} from '../types'
import { IconSearch, IconX } from './Icons'

interface FilterBarProps {
  filters: TaskFilters
  projects: string[]
  isActive: boolean
  onChange: (filters: TaskFilters) => void
  onClear: () => void
}

export function FilterBar({
  filters,
  projects,
  isActive,
  onChange,
  onClear,
}: FilterBarProps) {
  return (
    <div className="filter-bar" role="group" aria-label="Filtros de tareas">
      <label className="filter-search">
        <span className="sr-only">Buscar tareas</span>
        <IconSearch className="filter-search__icon" />
        <input
          type="search"
          value={filters.query}
          placeholder="Buscar por título, nota o proyecto…"
          autoComplete="off"
          onChange={(event) =>
            onChange({ ...filters, query: event.target.value })
          }
        />
        {filters.query !== '' && (
          <button
            type="button"
            className="filter-search__clear"
            aria-label="Limpiar búsqueda"
            onClick={() => onChange({ ...filters, query: '' })}
          >
            <IconX />
          </button>
        )}
      </label>

      <label className="filter-field">
        <span>Estado</span>
        <select
          value={filters.status}
          onChange={(event) =>
            onChange({
              ...filters,
              status: event.target.value as StatusFilter,
            })
          }
        >
          {Object.entries(STATUS_FILTER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field">
        <span>Prioridad</span>
        <select
          value={filters.priority}
          onChange={(event) =>
            onChange({
              ...filters,
              priority: event.target.value as PriorityFilter,
            })
          }
        >
          {Object.entries(PRIORITY_FILTER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field">
        <span>Proyecto</span>
        <select
          value={filters.project ?? ''}
          onChange={(event) =>
            onChange({
              ...filters,
              project: event.target.value || null,
            })
          }
          disabled={projects.length === 0}
        >
          <option value="">
            {projects.length === 0 ? 'Sin proyectos' : 'Todos'}
          </option>
          {projects.map((project) => (
            <option key={project} value={project}>
              {project}
            </option>
          ))}
        </select>
      </label>

      {isActive && (
        <button
          type="button"
          className="filter-bar__clear"
          onClick={onClear}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}
