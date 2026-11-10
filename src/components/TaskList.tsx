import { useState, type DragEvent } from 'react'
import type { Task, TaskSortMode, TaskStatus, ViewKey } from '../types'
import { EmptyState } from './EmptyState'
import { TaskCard, type DropPosition } from './TaskCard'

interface TaskListProps {
  tasks: Task[]
  view: ViewKey
  today: string
  hasFilters: boolean
  sortMode: TaskSortMode
  reorderEnabled: boolean
  selectedIds: ReadonlySet<string>
  onToggleSelected: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onStatusChange: (task: Task, status: TaskStatus) => void
  onToggleDone: (task: Task) => void
  onMoveToToday: (task: Task) => void
  onToggleSubtask: (taskId: string, subtaskId: string) => void
  onReorder: (orderedIds: readonly string[]) => void
  onCreate: () => void
  onClearFilters: () => void
}

interface DragOverState {
  id: string
  position: DropPosition
}

export function TaskList({
  tasks,
  view,
  today,
  hasFilters,
  sortMode,
  reorderEnabled,
  selectedIds,
  onToggleSelected,
  onEdit,
  onDelete,
  onStatusChange,
  onToggleDone,
  onMoveToToday,
  onToggleSubtask,
  onReorder,
  onCreate,
  onClearFilters,
}: TaskListProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<DragOverState | null>(null)

  if (tasks.length === 0) {
    return (
      <EmptyState
        view={view}
        hasFilters={hasFilters}
        onCreate={onCreate}
        onClearFilters={onClearFilters}
      />
    )
  }

  const selectable = view === 'overdue'
  const taskIds = tasks.map((task) => task.id)

  const resetDrag = () => {
    setDraggedId(null)
    setDragOver(null)
  }

  const handleDragStart = (event: DragEvent<HTMLElement>, id: string) => {
    if (!reorderEnabled) return

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
    setDraggedId(id)
  }

  const handleDragOver = (event: DragEvent<HTMLElement>, id: string) => {
    if (!reorderEnabled || !draggedId || draggedId === id) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    const rect = event.currentTarget.getBoundingClientRect()
    const position: DropPosition =
      event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'

    setDragOver((current) =>
      current?.id === id && current.position === position
        ? current
        : { id, position },
    )
  }

  const handleDrop = (event: DragEvent<HTMLElement>, targetId: string) => {
    if (!reorderEnabled) return

    event.preventDefault()
    const sourceId =
      draggedId || event.dataTransfer.getData('text/plain') || null
    const position = dragOver?.id === targetId ? dragOver.position : 'before'

    resetDrag()
    if (!sourceId || sourceId === targetId) return

    const remaining = taskIds.filter((id) => id !== sourceId)
    const targetIndex = remaining.indexOf(targetId)
    if (targetIndex === -1) return

    const insertAt = position === 'after' ? targetIndex + 1 : targetIndex
    remaining.splice(insertAt, 0, sourceId)
    onReorder(remaining)
  }

  const moveBy = (id: string, amount: number) => {
    const currentIndex = taskIds.indexOf(id)
    const nextIndex = currentIndex + amount
    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= taskIds.length) {
      return
    }

    const nextIds = [...taskIds]
    const [moved] = nextIds.splice(currentIndex, 1)
    nextIds.splice(nextIndex, 0, moved)
    onReorder(nextIds)
  }

  return (
    <>
      {sortMode === 'manual' && (
        <p
          className={`reorder-hint${
            reorderEnabled ? '' : ' reorder-hint--disabled'
          }`}
        >
          {reorderEnabled
            ? 'Modo manual: arrastra las tarjetas o usa las flechas para cambiar el orden.'
            : 'Quita los filtros para poder reordenar las tareas.'}
        </p>
      )}

      <div className="task-list" aria-label="Lista de tareas">
        {tasks.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
            today={today}
            selectable={selectable}
            selected={selectedIds.has(task.id)}
            reorderEnabled={reorderEnabled}
            isDragging={draggedId === task.id}
            dropPosition={
              dragOver?.id === task.id ? dragOver.position : null
            }
            canMoveUp={index > 0}
            canMoveDown={index < tasks.length - 1}
            onToggleSelected={onToggleSelected}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            onToggleDone={onToggleDone}
            onMoveToToday={onMoveToToday}
            onToggleSubtask={onToggleSubtask}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={resetDrag}
            onMoveUp={(id) => moveBy(id, -1)}
            onMoveDown={(id) => moveBy(id, 1)}
          />
        ))}
      </div>
    </>
  )
}
