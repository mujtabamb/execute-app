import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchTodaysTasks, fetchAllTasks,
  completeTask, uncompleteTask, carryOverTasks,
} from '../lib/db'
import {
  getLocalDayName, getLocalDateString,
  getYesterdayDayName, isCarryOverCandidate,
  RECURRENCE_LABELS,
} from '../lib/utils'

// ─── localStorage key to avoid re-prompting carry-over same day ───────────────
const CARRYOVER_DISMISSED_KEY = 'execute_carryover_dismissed'

function getCarryoverDismissedDate() {
  try { return localStorage.getItem(CARRYOVER_DISMISSED_KEY) || '' } catch { return '' }
}
function setCarryoverDismissedDate(date) {
  try { localStorage.setItem(CARRYOVER_DISMISSED_KEY, date) } catch {}
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ExecutionMode() {
  const today     = getLocalDayName()
  const todayDate = getLocalDateString()
  const yesterday = getYesterdayDayName()
  const yDate     = getLocalDateString(-1)

  const [tasks,        setTasks]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [animKey,      setAnimKey]      = useState(0)
  const [completing,   setCompleting]   = useState(false)

  // Undo toast state
  const [lastDone,     setLastDone]     = useState(null)   // { id, title }
  const [undoVisible,  setUndoVisible]  = useState(false)
  const undoTimerRef                    = useRef(null)

  // Long-press state on Done button
  const [holdProgress, setHoldProgress] = useState(0)       // 0–1
  const holdTimerRef                    = useRef(null)
  const holdAnimRef                     = useRef(null)

  // Carry-over state
  const [carryOver,      setCarryOver]      = useState([])   // tasks from yesterday
  const [carrySelected,  setCarrySelected]  = useState([])   // ids user checked
  const [carryPhase,     setCarryPhase]     = useState('idle') // idle | prompt | done

  // ─── Initial load ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [todayTasks, allTasks] = await Promise.all([
        fetchTodaysTasks(),
        fetchAllTasks(),
      ])
      setTasks(todayTasks)

      // Check carry-over — only once per day
      if (getCarryoverDismissedDate() !== todayDate) {
        const candidates = allTasks.filter((t) =>
          isCarryOverCandidate(t, yesterday, yDate)
        )
        if (candidates.length > 0) {
          setCarryOver(candidates)
          setCarrySelected(candidates.map((t) => t.id))  // all pre-selected
          setCarryPhase('prompt')
        }
      }
    } finally {
      setLoading(false)
    }
  }, [today, todayDate, yesterday, yDate])

  useEffect(() => { load() }, [load])

  // ─── Task state ─────────────────────────────────────────────────────────────
  const pending = tasks.filter((t) => t.last_completed_date !== todayDate)
  const done    = tasks.filter((t) => t.last_completed_date === todayDate)
  const current = pending[0] ?? null

  // ─── Undo toast helpers ──────────────────────────────────────────────────────
  function showUndo(task) {
    clearTimeout(undoTimerRef.current)
    setLastDone(task)
    setUndoVisible(true)
    undoTimerRef.current = setTimeout(() => {
      setUndoVisible(false)
      setLastDone(null)
    }, 3500)
  }

  async function handleUndo() {
    if (!lastDone) return
    clearTimeout(undoTimerRef.current)
    setUndoVisible(false)
    await uncompleteTask(lastDone.id)
    setTasks((prev) =>
      prev.map((t) =>
        t.id === lastDone.id ? { ...t, last_completed_date: null } : t
      )
    )
    setLastDone(null)
    setAnimKey((k) => k + 1)
  }

  // ─── Long-press Done to undo ─────────────────────────────────────────────────
  function startHold() {
    if (!undoVisible || !lastDone) return
    let start = Date.now()
    const HOLD_MS = 600

    function tick() {
      const elapsed = Date.now() - start
      setHoldProgress(Math.min(elapsed / HOLD_MS, 1))
      if (elapsed >= HOLD_MS) {
        setHoldProgress(0)
        handleUndo()
      } else {
        holdAnimRef.current = requestAnimationFrame(tick)
      }
    }
    holdAnimRef.current = requestAnimationFrame(tick)
  }

  function cancelHold() {
    cancelAnimationFrame(holdAnimRef.current)
    clearTimeout(holdTimerRef.current)
    setHoldProgress(0)
  }

  // ─── Done ───────────────────────────────────────────────────────────────────
  async function handleDone() {
    if (!current || completing) return
    setCompleting(true)
    const taskSnapshot = { id: current.id, title: current.title }
    await completeTask(current.id, todayDate)
    setTasks((prev) =>
      prev.map((t) =>
        t.id === current.id ? { ...t, last_completed_date: todayDate } : t
      )
    )
    setAnimKey((k) => k + 1)
    showUndo(taskSnapshot)
    setCompleting(false)
  }

  // ─── Skip ───────────────────────────────────────────────────────────────────
  function handleSkip() {
    if (!current || completing || pending.length <= 1) return
    setTasks((prev) => {
      const without = prev.filter((t) => t.id !== current.id)
      return [...without, current]
    })
    setAnimKey((k) => k + 1)
  }

  // ─── Carry-over ─────────────────────────────────────────────────────────────
  function toggleCarrySelect(id) {
    setCarrySelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function acceptCarryOver() {
    setCarryPhase('done')
    if (carrySelected.length > 0) {
      await carryOverTasks(carrySelected, today)
      // Reload tasks to include the carried-over ones
      const fresh = await fetchTodaysTasks()
      setTasks(fresh)
    }
    setCarryoverDismissedDate(todayDate)
    setCarryPhase('idle')
  }

  function dismissCarryOver() {
    setCarryoverDismissedDate(todayDate)
    setCarryPhase('idle')
    setCarryOver([])
  }

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="exec">
        <div className="exec__loading">
          <div className="exec__spinner" />
          <span className="exec__loading-text">Loading…</span>
        </div>
      </div>
    )
  }

  // ─── Carry-over prompt ───────────────────────────────────────────────────────
  if (carryPhase === 'prompt') {
    return (
      <div className="exec exec--carryover">
        <div className="carryover">
          <div className="carryover__icon">↩</div>
          <h2 className="carryover__title">
            {carryOver.length} unfinished task{carryOver.length !== 1 ? 's' : ''} from {yesterday}
          </h2>
          <p className="carryover__sub">Roll them into today?</p>

          <div className="carryover__list">
            {carryOver.map((task) => (
              <label key={task.id} className="carryover__item">
                <input
                  type="checkbox"
                  className="carryover__checkbox"
                  checked={carrySelected.includes(task.id)}
                  onChange={() => toggleCarrySelect(task.id)}
                />
                <span className="carryover__item-title">{task.title}</span>
              </label>
            ))}
          </div>

          <div className="carryover__actions">
            <button
              className="carryover__btn-accept"
              onClick={acceptCarryOver}
              disabled={carryPhase === 'done'}
            >
              {carrySelected.length > 0
                ? `Add ${carrySelected.length} to today`
                : 'Continue without adding'}
            </button>
            <button className="carryover__btn-dismiss" onClick={dismissCarryOver}>
              Skip, don't ask again today
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── No tasks today ──────────────────────────────────────────────────────────
  if (tasks.length === 0) {
    return (
      <div className="exec">
        <ExecHeader today={today} done={0} total={0} />
        <div className="exec__empty">
          <div className="exec__empty-icon">◌</div>
          <h2 className="exec__empty-title">Nothing scheduled</h2>
          <p className="exec__empty-sub">
            Open the Planner tab<br />to add tasks for {today}.
          </p>
        </div>
      </div>
    )
  }

  // ─── All done ────────────────────────────────────────────────────────────────
  if (pending.length === 0) {
    return (
      <div className="exec">
        <ExecHeader today={today} done={done.length} total={tasks.length} />
        <div className="exec__empty">
          <div className="exec__empty-icon">✦</div>
          <h2 className="exec__empty-title">All done.</h2>
          <p className="exec__empty-sub">
            {done.length} task{done.length !== 1 ? 's' : ''} complete today.<br />
            See you tomorrow.
          </p>
        </div>
        {undoVisible && <UndoToast onUndo={handleUndo} />}
      </div>
    )
  }

  // ─── Main execution view ─────────────────────────────────────────────────────
  const canSkip   = pending.length > 1
  const recLabel  = RECURRENCE_LABELS[current.recurrence || 'weekly']

  return (
    <div className="exec">
      <ExecHeader today={today} done={done.length} total={tasks.length} />

      <div className="exec__center">
        {/* Task display */}
        <div className="exec__task" key={animKey}>
          {recLabel && recLabel !== '↻ Weekly' && (
            <div className="exec__recurrence-badge">{recLabel}</div>
          )}
          <h1 className="exec__task-title">{current.title}</h1>
        </div>

        {/* Actions */}
        <div className="exec__actions">
          {/* Done button — long-press to undo last task */}
          <div className="exec__done-wrap">
            <button
              className="btn-done"
              onClick={handleDone}
              onMouseDown={startHold}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onTouchStart={startHold}
              onTouchEnd={cancelHold}
              disabled={completing}
              style={{
                '--hold-progress': holdProgress,
                background: holdProgress > 0
                  ? `linear-gradient(90deg, var(--accent-dark) ${holdProgress * 100}%, var(--accent) ${holdProgress * 100}%)`
                  : undefined,
              }}
            >
              {completing ? '…' : holdProgress > 0 ? 'Hold to undo…' : 'Done'}
            </button>

            {/* 3-second undo toast */}
            {undoVisible && <UndoToast onUndo={handleUndo} />}
          </div>

          {/* Skip row */}
          <div className="exec__skip-row">
            <button
              className={`btn-skip${!canSkip ? ' btn-skip--disabled' : ''}`}
              onClick={handleSkip}
              disabled={!canSkip || completing}
              title={!canSkip ? 'No other tasks to skip to' : 'Push to bottom of list'}
            >
              ↷ Skip for now
            </button>
            {!canSkip && (
              <span className="exec__skip-hint">only task left</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ExecHeader({ today, done, total }) {
  return (
    <div className="exec__header">
      <span className="exec__day-label">{today}</span>
      {total > 0 && <span className="exec__progress">{done} / {total}</span>}
    </div>
  )
}

function UndoToast({ onUndo }) {
  return (
    <div className="undo-toast" onClick={onUndo}>
      <span className="undo-toast__text">Task marked done</span>
      <button className="undo-toast__btn">Undo</button>
    </div>
  )
}
