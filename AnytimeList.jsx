import { useState, useEffect, useRef } from 'react'
import {
  fetchAnytimeTasks,
  addAnytimeTask,
  toggleAnytimeTask,
  deleteAnytimeTask,
  deleteAllAnytimeTasks,
} from '../lib/db'

export default function AnytimeList() {
  const [tasks, setTasks]         = useState([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(true)
  const [adding, setAdding]       = useState(false)
  const [allDoneAnim, setAllDoneAnim] = useState(false)
  const inputRef                  = useRef(null)

  useEffect(() => {
    fetchAnytimeTasks().then((data) => {
      setTasks(data)
      setLoading(false)
    })
  }, [])

  // ── Auto-clear when every task is completed ──────────────────────────────
  useEffect(() => {
    if (loading) return
    if (tasks.length === 0) return
    const allDone = tasks.every((t) => t.completed)
    if (!allDone) return

    // Brief moment to show all ticked, then wipe
    setAllDoneAnim(true)
    const timer = setTimeout(async () => {
      await deleteAllAnytimeTasks(tasks.map((t) => t.id))
      setTasks([])
      setAllDoneAnim(false)
    }, 900)

    return () => clearTimeout(timer)
  }, [tasks, loading])

  async function handleAdd(e) {
    e.preventDefault()
    const val = input.trim()
    if (!val) return
    setAdding(true)
    setInput('')
    const newTask = await addAnytimeTask(val)
    setTasks((prev) => [...prev, newTask])
    setAdding(false)
    inputRef.current?.focus()
  }

  async function handleToggle(id, completed) {
    await toggleAnytimeTask(id, completed)
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed } : t))
    )
  }

  async function handleDelete(id) {
    await deleteAnytimeTask(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const incomplete = tasks.filter((t) => !t.completed)
  const complete   = tasks.filter((t) =>  t.completed)

  return (
    <div className="screen">
      <h1 className="screen__title">Anytime</h1>

      {/* Add input */}
      <form className="anytime__add" onSubmit={handleAdd}>
        <input
          ref={inputRef}
          className="anytime__input"
          placeholder="Add a task…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={adding}
          maxLength={200}
        />
        <button
          type="submit"
          className="anytime__add-btn"
          disabled={!input.trim() || adding}
        >
          Add
        </button>
      </form>

      {/* Loading */}
      {loading && (
        <div className="anytime__loading-text">Loading…</div>
      )}

      {/* All-done burst before auto-clear */}
      {allDoneAnim && (
        <div className="anytime__burst">
          <div className="anytime__burst-icon">✦</div>
          <p className="anytime__burst-text">All cleared!</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !allDoneAnim && tasks.length === 0 && (
        <div className="anytime__empty">
          <div className="anytime__empty-icon">✦</div>
          <p>Your anytime list is empty.</p>
          <p>Add tasks that don't belong to any specific day.</p>
        </div>
      )}

      {/* Task lists — hidden during burst */}
      {!allDoneAnim && (
        <>
          {/* Incomplete */}
          {incomplete.length > 0 && (
            <div className="anytime__list">
              {incomplete.map((task) => (
                <AnytimeTask
                  key={task.id}
                  task={task}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {/* Completed */}
          {complete.length > 0 && (
            <>
              <div className="section-divider" />
              <p className="completed-section-label">Completed</p>
              <div className="anytime__list">
                {complete.map((task) => (
                  <AnytimeTask
                    key={task.id}
                    task={task}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function AnytimeTask({ task, onToggle, onDelete }) {
  return (
    <div className="anytime-task">
      <button
        className={`anytime-task__check${task.completed ? ' checked' : ''}`}
        onClick={() => onToggle(task.id, !task.completed)}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {task.completed ? '✓' : ''}
      </button>

      <span className={`anytime-task__title${task.completed ? ' completed' : ''}`}>
        {task.title}
      </span>

      <button
        className="anytime-task__delete"
        onClick={() => {
          if (window.confirm(`Delete "${task.title}"?`)) onDelete(task.id)
        }}
        aria-label="Delete task"
      >
        ✕
      </button>
    </div>
  )
}
