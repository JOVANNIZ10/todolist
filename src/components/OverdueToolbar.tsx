import { useEffect, useRef } from 'react'
import { pluralize } from '../lib/formatters'
import { IconArrowRight } from './Icons'

interface OverdueToolbarProps {
  visibleIds: string[]
  selectedIds: ReadonlySet<string>
  onSelectAll: () => void
  onClearSelection: () => void
  onMoveSelected: () => void
}

export function OverdueToolbar({
  visibleIds,
  selectedIds,
  onSelectAll,
  onClearSelection,
  onMoveSelected,
}: OverdueToolbarProps) {
  const selectAllRef = useRef<HTMLInputElement>(null)
  const selectedVisibleCount = visibleIds.filter((id) =>
    selectedIds.has(id),
  ).length
  const allSelected =
    visibleIds.length > 0 && selectedVisibleCount === visibleIds.length
  const someSelected = selectedVisibleCount > 0 && !allSelected

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected
    }
  }, [someSelected])

  if (visibleIds.length === 0) return null

  return (
    <div className="batch-toolbar">
      <label className="batch-toolbar__select-all">
        <input
          ref={selectAllRef}
          type="checkbox"
          checked={allSelected}
          onChange={() => {
            if (allSelected) {
              onClearSelection()
            } else {
              onSelectAll()
            }
          }}
        />
        <span>
          {allSelected ? 'Deseleccionar todas' : 'Seleccionar todas'}
        </span>
      </label>

      <p className="batch-toolbar__count" aria-live="polite">
        {selectedVisibleCount > 0
          ? `${pluralize(
              selectedVisibleCount,
              'tarea seleccionada',
              'tareas seleccionadas',
            )}`
          : 'Elige las que quieras recuperar'}
      </p>

      <button
        type="button"
        className="button button--compact button--secondary"
        disabled={selectedVisibleCount === 0}
        onClick={onMoveSelected}
      >
        Mover a hoy
        <IconArrowRight />
      </button>
    </div>
  )
}
