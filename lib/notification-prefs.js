// Notification preferences shared by the API (validation/defaults) and the
// app (UI + scheduling). Pure functions, no browser or Node APIs.

// How far ahead of the expiry date the user can be reminded (0 = on the day).
export const DAY_OPTIONS = [
  { value: 30, label: '30 dias antes' },
  { value: 15, label: '15 dias antes' },
  { value: 7, label: '7 dias antes' },
  { value: 3, label: '3 dias antes' },
  { value: 1, label: '1 dia antes' },
  { value: 0, label: 'No dia' },
]

export const HOUR_MIN = 6
export const HOUR_MAX = 22

export const DEFAULT_NOTIFICATION_PREFS = {
  enabled: true,
  days_before: [30, 7, 0],
  hour: 9,
}

const ALLOWED_DAYS = new Set(DAY_OPTIONS.map(o => o.value))

// Accepts whatever came from the database/network and returns a clean,
// complete prefs object (unknown values dropped, missing ones defaulted).
export function normalizeNotificationPrefs(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const enabled = typeof src.enabled === 'boolean' ? src.enabled : DEFAULT_NOTIFICATION_PREFS.enabled

  let days = Array.isArray(src.days_before)
    ? src.days_before.map(Number).filter(n => Number.isInteger(n) && ALLOWED_DAYS.has(n))
    : DEFAULT_NOTIFICATION_PREFS.days_before
  days = [...new Set(days)].sort((a, b) => b - a)

  const h = Number(src.hour)
  const hour = Number.isInteger(h) && h >= HOUR_MIN && h <= HOUR_MAX ? h : DEFAULT_NOTIFICATION_PREFS.hour

  return { enabled, days_before: days, hour }
}
