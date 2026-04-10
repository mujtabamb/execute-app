import { supabase } from './supabase'
import { taskMatchesToday } from './utils'

// ─── localStorage keys ────────────────────────────────────────────────────────
const TASKS_KEY  = 'execute_tasks'
const ANYTIME_KEY = 'execute_anytime_tasks'

// ─── localStorage helpers ─────────────────────────────────────────────────────
function localGet(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}
function localSet(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
}

// ─── Weekly Tasks ─────────────────────────────────────────────────────────────

export async function fetchAllTasks() {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('tasks').select('*').order('order', { ascending: true })
      if (!error && data) { localSet(TASKS_KEY, data); return data }
    }
  } catch {}
  return localGet(TASKS_KEY)
}

// Returns tasks that match TODAY — handles all recurrence patterns
export async function fetchTodaysTasks() {
  const all = await fetchAllTasks()
  return all.filter(taskMatchesToday).sort((a, b) => a.order - b.order)
}

// Carry-over: update yesterday's unfinished weekly tasks to run today
export async function carryOverTasks(taskIds, todayName) {
  const updates = { day: todayName, last_completed_date: null }

  // Optimistic local update
  const local = localGet(TASKS_KEY).map((t) =>
    taskIds.includes(t.id) ? { ...t, ...updates } : t
  )
  localSet(TASKS_KEY, local)

  try {
    if (supabase) {
      await Promise.all(
        taskIds.map((id) =>
          supabase.from('tasks').update(updates).eq('id', id)
        )
      )
    }
  } catch {}
}

export async function addTask(title, day, recurrence = 'weekly', allTasks = []) {
  const dayTasks = allTasks.filter((t) => t.day === day)
  const maxOrder = dayTasks.length > 0 ? Math.max(...dayTasks.map((t) => t.order)) : -1

  const newTask = {
    id: crypto.randomUUID(),
    title: title.trim(),
    day,
    recurrence,
    order: maxOrder + 1,
    last_completed_date: null,
    created_at: new Date().toISOString(),
  }

  localSet(TASKS_KEY, [...localGet(TASKS_KEY), newTask])

  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('tasks').insert(newTask).select().single()
      if (!error && data) {
        const local = localGet(TASKS_KEY).filter((t) => t.id !== newTask.id)
        localSet(TASKS_KEY, [...local, data])
        return data
      }
    }
  } catch {}

  return newTask
}

export async function updateTask(id, updates) {
  const local = localGet(TASKS_KEY).map((t) =>
    t.id === id ? { ...t, ...updates } : t
  )
  localSet(TASKS_KEY, local)

  try {
    if (supabase) { await supabase.from('tasks').update(updates).eq('id', id) }
  } catch {}

  return local.find((t) => t.id === id)
}

export async function deleteTask(id) {
  localSet(TASKS_KEY, localGet(TASKS_KEY).filter((t) => t.id !== id))
  try {
    if (supabase) { await supabase.from('tasks').delete().eq('id', id) }
  } catch {}
}

export async function reorderTasks(dayTasks) {
  const map = Object.fromEntries(dayTasks.map((t) => [t.id, t]))
  const local = localGet(TASKS_KEY).map((t) =>
    map[t.id] ? { ...t, order: map[t.id].order } : t
  )
  localSet(TASKS_KEY, local)

  try {
    if (supabase) {
      await Promise.all(
        dayTasks.map((t) =>
          supabase.from('tasks').update({ order: t.order }).eq('id', t.id)
        )
      )
    }
  } catch {}
}

export async function completeTask(id, dateStr) {
  return updateTask(id, { last_completed_date: dateStr })
}

export async function uncompleteTask(id) {
  return updateTask(id, { last_completed_date: null })
}

// ─── Anytime Tasks ────────────────────────────────────────────────────────────

export async function fetchAnytimeTasks() {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('anytime_tasks').select('*').order('created_at', { ascending: true })
      if (!error && data) { localSet(ANYTIME_KEY, data); return data }
    }
  } catch {}
  return localGet(ANYTIME_KEY)
}

export async function addAnytimeTask(title) {
  const newTask = {
    id: crypto.randomUUID(),
    title: title.trim(),
    completed: false,
    created_at: new Date().toISOString(),
  }
  localSet(ANYTIME_KEY, [...localGet(ANYTIME_KEY), newTask])

  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('anytime_tasks').insert(newTask).select().single()
      if (!error && data) {
        const local = localGet(ANYTIME_KEY).filter((t) => t.id !== newTask.id)
        localSet(ANYTIME_KEY, [...local, data])
        return data
      }
    }
  } catch {}
  return newTask
}

export async function toggleAnytimeTask(id, completed) {
  const local = localGet(ANYTIME_KEY).map((t) =>
    t.id === id ? { ...t, completed } : t
  )
  localSet(ANYTIME_KEY, local)
  try {
    if (supabase) {
      await supabase.from('anytime_tasks').update({ completed }).eq('id', id)
    }
  } catch {}
}

export async function deleteAnytimeTask(id) {
  localSet(ANYTIME_KEY, localGet(ANYTIME_KEY).filter((t) => t.id !== id))
  try {
    if (supabase) { await supabase.from('anytime_tasks').delete().eq('id', id) }
  } catch {}
}

export async function deleteAllAnytimeTasks(ids) {
  localSet(ANYTIME_KEY, [])
  try {
    if (supabase) { await supabase.from('anytime_tasks').delete().in('id', ids) }
  } catch {}
}
