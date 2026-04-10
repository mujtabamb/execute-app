// ─── All date logic uses LOCAL device time — never UTC ────────────────────────

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export function getLocalDayName() {
  return DAY_NAMES[new Date().getDay()]
}

export function getLocalDateString(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getYesterdayDayName() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return DAY_NAMES[d.getDay()]
}

// Ordered week: Saturday → Friday
export const WEEK_DAYS = [
  'Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday',
]

export function isToday(dayName) {
  return dayName === getLocalDayName()
}

export function formatDayLabel(dayName) {
  return isToday(dayName) ? `${dayName} — Today` : dayName
}

// ─── Recurrence ───────────────────────────────────────────────────────────────

export const RECURRENCE_OPTIONS = [
  { value: 'weekly',   label: 'Weekly',   hint: 'Every week on this day' },
  { value: 'daily',    label: 'Daily',    hint: 'Every single day' },
  { value: 'weekdays', label: 'Weekdays', hint: 'Mon – Fri' },
  { value: 'weekends', label: 'Weekends', hint: 'Sat & Sun' },
]

export const RECURRENCE_LABELS = {
  weekly:   '↻ Weekly',
  daily:    '↻ Daily',
  weekdays: '↻ Weekdays',
  weekends: '↻ Weekends',
}

// Does this task run on today's date?
export function taskMatchesToday(task) {
  const today  = getLocalDayName()
  const dow    = new Date().getDay()           // 0=Sun … 6=Sat
  const isWday = dow >= 1 && dow <= 5
  const isWend = dow === 0 || dow === 6
  const rec    = task.recurrence || 'weekly'

  switch (rec) {
    case 'daily':    return true
    case 'weekdays': return isWday
    case 'weekends': return isWend
    case 'weekly':
    default:         return task.day === today
  }
}

// Does this task run on a SPECIFIC day name?
export function taskMatchesDay(task, dayName) {
  const d   = new Date(dayName === getYesterdayDayName()
    ? Date.now() - 86_400_000
    : Date.now())
  const dow    = d.getDay()
  const isWday = dow >= 1 && dow <= 5
  const isWend = dow === 0 || dow === 6
  const rec    = task.recurrence || 'weekly'

  switch (rec) {
    case 'daily':    return true
    case 'weekdays': return isWday
    case 'weekends': return isWend
    case 'weekly':
    default:         return task.day === dayName
  }
}

// Should this task be offered as carry-over?
// Only weekly tasks assigned to yesterday that weren't completed.
export function isCarryOverCandidate(task, yesterdayName, yesterdayDate) {
  const rec = task.recurrence || 'weekly'
  if (rec !== 'weekly') return false            // daily/weekdays/weekends reset naturally
  if (task.day !== yesterdayName) return false
  if (task.last_completed_date === yesterdayDate) return false
  return true
}
