import { useState, useEffect, useRef } from 'react'
import { fetchAllTasks, addTask, updateTask, deleteTask, reorderTasks } from '../lib/db'
import {
  WEEK_DAYS, RECURRENCE_OPTIONS, RECURRENCE_LABELS,
  getLocalDayName, formatDayLabel,
} from '../lib/utils'

export default function WeeklyPlanner() {
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAllTasks().then((data) => { setTasks(data); setLoading(false) })
  }, [])

  function getTasksForDay(day) {
    return tasks.filter((t) => t.day === day).sort((a, b) => a.order - b.order)
  }

  // recurring tasks managed on non-home-days still appear in planner under home-day
  // so we also surface daily/weekdays/weekends tasks in a top "Recurring" panel
  const recurringTasks = tasks.filter((t) =>
    t.recurrence && t.recurrence !== 'weekly'
  )

  async function handleAdd(title, day, recurrence) {
    const newTask = await addTask(title, day, recurrence, tasks)
    setTasks((prev) => [...prev, newTask])
  }

  async function handleUpdate(id, fields) {
    await updateTask(id, fields)
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...fields } : t))
  }

  async function handleDelete(id) {
    await deleteTask(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  async function handleMove(day, taskId, dir) {
    const dt  = getTasksForDay(day)
    const idx = dt.findIndex((t) => t.id === taskId)
    if (dir === 'up' && idx === 0) return
    if (dir === 'down' && idx === dt.length - 1) return

    const swap    = dir === 'up' ? idx - 1 : idx + 1
    const updated = [...dt]
    ;[updated[idx], updated[swap]] = [updated[swap], updated[idx]]
    const reordered = updated.map((t, i) => ({ ...t, order: i }))

    setTasks((prev) => {
      const others = prev.filter((t) => t.day !== day)
      return [...others, ...reordered]
    })
    await reorderTasks(reordered)
  }

  if (loading) {
    return (
      <div className="screen">
        <div className="anytime__loading-text">Loading…</div>
      </div>
    )
  }

  return (
    <div className="screen">
      <h1 className="screen__title">Planner</h1>

      {/* Recurring tasks panel */}
      {recurringTasks.length > 0 && (
        <div className="recurring-panel">
          <div className="recurring-panel__header">
            <span className="recurring-panel__label">↻ Recurring tasks</span>
            <span className="recurring-panel__hint">shown here and on matching days</span>
          </div>
          {recurringTasks.map((task) => (
            <PlannerTask
              key={task.id}
              task={task}
              isFirst={false}
              isLast={false}
              hideOrderBtns
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onMoveUp={() => {}}
              onMoveDown={() => {}}
            />
          ))}
        </div>
      )}

      <div className="planner__days">
        {WEEK_DAYS.map((day) => (
          <DaySection
            key={day}
            day={day}
            tasks={getTasksForDay(day)}
            isToday={day === getLocalDayName()}
            onAdd={handleAdd}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onMove={handleMove}
          />
        ))}
      </div>
    </div>
  )
}

// ─── DaySection ───────────────────────────────────────────────────────────────
function DaySection({ day, tasks, isToday, onAdd, onUpdate, onDelete, onMove }) {
  const [input,      setInput]      = useState('')
  const [recurrence, setRecurrence] = useState('weekly')
  const [adding,     setAdding]     = useState(false)
  const [expanded,   setExpanded]   = useState(false)
  const inputRef                    = useRef(null)

  async function handleAdd(e) {
    e.preventDefault()
    const val = input.trim()
    if (!val) return
    setAdding(true)
    setInput('')
    await onAdd(val, day, recurrence)
    setRecurrence('weekly')
    setExpanded(false)
    setAdding(false)
  }

  // Weekly tasks assigned to this day (no daily/weekdays/weekends here)
  const weeklyTasks = tasks.filter(
    (t) => !t.recurrence || t.recurrence === 'weekly'
  )

  return (
    <section className={`day-section${isToday ? ' day-section--today' : ''}`}>
      <div className="day-section__header">
        <span className="day-section__name">{formatDayLabel(day)}</span>
        {isToday && <span className="day-section__today-badge">Today</span>}
      </div>

      <div className="day-section__tasks">
        {weeklyTasks.length === 0 && (
          <div className="day-section__empty">No tasks — add one below</div>
        )}
        {weeklyTasks.map((task, idx) => (
          <PlannerTask
            key={task.id}
            task={task}
            isFirst={idx === 0}
            isLast={idx === weeklyTasks.length - 1}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onMoveUp={() => onMove(day, task.id, 'up')}
            onMoveDown={() => onMove(day, task.id, 'down')}
          />
        ))}
      </div>

      {/* Add row */}
      <div className="day-section__add">
        <form onSubmit={handleAdd}>
          <div className="day-section__add-row">
            <input
              ref={inputRef}
              className="day-section__input"
              placeholder="Add task…"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                if (e.target.value && !expanded) setExpanded(true)
                if (!e.target.value) setExpanded(false)
              }}
              disabled={adding}
              maxLength={200}
            />
            <button
              type="submit"
              className="day-section__add-btn"
              disabled={!input.trim() || adding}
            >
              Add
            </button>
          </div>

          {/* Recurrence picker — slides in when typing */}
          {expanded && (
            <div className="recurrence-picker">
              {RECURRENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`recurrence-pill${recurrence === opt.value ? ' recurrence-pill--active' : ''}`}
                  onClick={() => setRecurrence(opt.value)}
                  title={opt.hint}
                >
                  {opt.label}
                </button>
              ))}
              <span className="recurrence-picker__hint">
                {RECURRENCE_OPTIONS.find((o) => o.value === recurrence)?.hint}
              </span>
            </div>
          )}
        </form>
      </div>
    </section>
  )
}

// ─── PlannerTask ──────────────────────────────────────────────────────────────
function PlannerTask({
  task, isFirst, isLast, hideOrderBtns,
  onUpdate, onDelete, onMoveUp, onMoveDown,
}) {
  const [editing,     setEditing]     = useState(false)
  const [editTitle,   setEditTitle]   = useState(task.title)
  const [editRec,     setEditRec]     = useState(task.recurrence || 'weekly')
  const titleInputRef                 = useRef(null)

  function startEdit() {
    setEditTitle(task.title)
    setEditRec(task.recurrence || 'weekly')
    setEditing(true)
    setTimeout(() => titleInputRef.current?.focus(), 0)
  }

  function cancelEdit() {
    setEditing(false)
  }

  async function saveEdit() {
    const val = editTitle.trim()
    if (!val) { cancelEdit(); return }
    await onUpdate(task.id, { title: val, recurrence: editRec })
    setEditing(false)
  }

  const recLabel = RECURRENCE_LABELS[task.recurrence || 'weekly']
  const showBadge = task.recurrence && task.recurrence !== 'weekly'

  return (
    <div className={`planner-task${editing ? ' planner-task--editing' : ''}`}>
      {/* Order arrows */}
      {!hideOrderBtns && (
        <div className="planner-task__order-btns">
          <button
            className="planner-task__order-btn"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Move up"
          >↑</button>
          <button
            className="planner-task__order-btn"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Move down"
          >↓</button>
        </div>
      )}

      {/* Content */}
      <div className="planner-task__content">
        {editing ? (
          <>
            <input
              ref={titleInputRef}
              className="planner-task__title-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') cancelEdit()
              }}
              maxLength={200}
            />
            <div className="recurrence-picker recurrence-picker--inline">
              {RECURRENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`recurrence-pill recurrence-pill--sm${editRec === opt.value ? ' recurrence-pill--active' : ''}`}
                  onClick={() => setEditRec(opt.value)}
                  title={opt.hint}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <span className="planner-task__title">{task.title}</span>
            {showBadge && (
              <span className="planner-task__rec-badge">{recLabel}</span>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="planner-task__actions">
        {editing ? (
          <>
            <button
              className="planner-task__btn planner-task__btn--save"
              onMouseDown={(e) => { e.preventDefault(); saveEdit() }}
              title="Save"
            >✓</button>
            <button
              className="planner-task__btn"
              onMouseDown={(e) => { e.preventDefault(); cancelEdit() }}
              title="Cancel"
            >✕</button>
          </>
        ) : (
          <>
            <button
              className="planner-task__btn"
              onClick={startEdit}
              title="Edit"
            >✎</button>
            <button
              className="planner-task__btn planner-task__btn--delete"
              onClick={() => {
                if (window.confirm(`Delete "${task.title}"?`)) onDelete(task.id)
              }}
              title="Delete"
            >✕</button>
          </>
        )}
      </div>
    </div>
  )
}
