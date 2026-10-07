// Expiry reminders.
//
// Android app: reminders are scheduled ON THE DEVICE with Capacitor's
// LocalNotifications plugin, so they arrive even with the app closed, with
// no server, no Firebase and no cost. They are rebuilt every time the app
// opens or the medicines / settings change.
//
// Browser/PWA: there is no reliable way to schedule for later, so reminders
// are shown when the app is opened (once per medicine/day).
//
// The planning code at the top is pure (no browser APIs) so it can be tested.

import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

export const CHANNEL_ID = 'vencimentos'
const SMALL_ICON = 'ic_stat_homemed' // android/app/src/main/res/drawable
const ICON_COLOR = '#2563EB'
const TEST_ID = 1 // plan ids are YYYYMMDD (~20 million), so they never clash
const PLAN_LIMIT = 120 // soonest reminders kept; far below Android's alarm limits

/* ───────────────────────── planning (pure) ───────────────────────── */

// "2026-10-20" -> local midnight of that day (NOT UTC, which in Brazil is
// the evening before). Returns null for anything unparseable.
export function parseLocalDate(value) {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return isNaN(d) ? null : d
  }
  const d = new Date(value)
  if (isNaN(d)) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function medicineLabel(m) {
  return `${m.nome_comercial || 'Medicamento'}${m.concentracao ? ' ' + m.concentracao : ''}`
}

function offsetLabel(n) {
  if (n === 0) return 'hoje'
  if (n === 1) return 'amanhã'
  return `em ${n} dias`
}

const pad = (n) => String(n).padStart(2, '0')
const fmtShort = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`

// items: [{ name, offset, expiry: Date }] -> { title, body, largeBody }
export function buildMessage(items) {
  const sorted = [...items].sort((a, b) => a.offset - b.offset || a.name.localeCompare(b.name, 'pt-BR'))

  if (sorted.length === 1) {
    const it = sorted[0]
    if (it.offset === 0) {
      return {
        title: 'Medicamento vence hoje',
        body: `${it.name} vence hoje. Confira antes de usar e descarte se preciso.`,
      }
    }
    if (it.offset === 1) {
      return {
        title: 'Medicamento vence amanhã',
        body: `${it.name} vence amanhã (${fmtShort(it.expiry)}).`,
      }
    }
    return {
      title: 'Medicamento perto de vencer',
      body: `${it.name} vence em ${it.offset} dias (${fmtShort(it.expiry)}).`,
    }
  }

  const shown = sorted.slice(0, 2).map(it => `${it.name} (${offsetLabel(it.offset)})`)
  const rest = sorted.length - shown.length
  const body = rest > 0 ? `${shown.join(', ')} e mais ${rest}.` : `${shown.join(' e ')}.`
  const lines = sorted.slice(0, 8).map(it => `• ${it.name} — ${offsetLabel(it.offset)}`)
  if (sorted.length > 8) lines.push(`… e mais ${sorted.length - 8}`)
  return {
    title: `${sorted.length} medicamentos precisam de atenção`,
    body,
    largeBody: lines.join('\n'),
  }
}

// Builds the list of future reminders for the given medicines and prefs.
// One reminder per calendar day (all medicines due that day are grouped).
export function buildNotificationPlan(medicines, prefs, now = new Date(), limit = PLAN_LIMIT) {
  if (!prefs?.enabled || !prefs.days_before?.length) return []
  const groups = new Map()

  for (const m of medicines || []) {
    const expiry = parseLocalDate(m.data_validade)
    if (!expiry) continue
    for (const offset of prefs.days_before) {
      const at = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate() - offset, prefs.hour, 0, 0, 0)
      if (at.getTime() <= now.getTime() + 5000) continue // already past
      const key = at.getFullYear() * 10000 + (at.getMonth() + 1) * 100 + at.getDate() // YYYYMMDD, also the id
      if (!groups.has(key)) groups.set(key, { id: key, at, items: [], medicineIds: [] })
      const g = groups.get(key)
      g.items.push({ name: medicineLabel(m), offset, expiry })
      g.medicineIds.push(m.id)
    }
  }

  return [...groups.values()]
    .sort((a, b) => a.at - b.at)
    .slice(0, limit)
    .map(g => ({ id: g.id, at: g.at, medicineIds: g.medicineIds, count: g.items.length, ...buildMessage(g.items) }))
}

// Short human text for the "next reminder" line in Settings.
export function describeNextReminder(plan) {
  if (!plan.length) return null
  const p = plan[0]
  const day = p.at.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return { when: `${day}, às ${pad(p.at.getHours())}:00`, title: p.title, body: p.body }
}

/* ───────────────────────── device (native / web) ───────────────────────── */

export function isNativeApp() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications')
}

// 'granted' | 'denied' | 'prompt' | 'unsupported'
export async function getNotificationPermission() {
  try {
    if (isNativeApp()) {
      const { display } = await LocalNotifications.checkPermissions()
      if (display === 'granted') return 'granted'
      if (display === 'denied') return 'denied'
      return 'prompt'
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const p = Notification.permission
      return p === 'default' ? 'prompt' : p
    }
  } catch { /* fall through */ }
  return 'unsupported'
}

export async function requestNotificationPermission() {
  try {
    if (isNativeApp()) {
      const { display } = await LocalNotifications.requestPermissions()
      return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt'
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const p = await Notification.requestPermission()
      return p === 'default' ? 'prompt' : p
    }
  } catch { /* fall through */ }
  return 'unsupported'
}

let channelReady = false
async function ensureChannel() {
  if (channelReady) return
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Avisos de vencimento',
      description: 'Lembretes de medicamentos perto de vencer',
      importance: 4,
      // Private: medicine names (health data) are hidden on the lock screen
      // when the phone is set to hide sensitive content.
      visibility: 0,
      vibration: true,
    })
    channelReady = true
  } catch (e) {
    console.warn('createChannel failed', e)
  }
}

// Native writes are serialised so quick successive changes can't interleave
// their cancel/schedule steps.
let nativeQueue = Promise.resolve()

// Replaces everything scheduled on the device with the current plan.
// Resolves to the plan that was scheduled ([] if disabled / not allowed).
export function syncNativeReminders(medicines, prefs) {
  const run = async () => {
    await ensureChannel()
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) })
    }
    if (!prefs.enabled) return []
    if ((await getNotificationPermission()) !== 'granted') return []
    const plan = buildNotificationPlan(medicines, prefs)
    if (plan.length) {
      await LocalNotifications.schedule({
        notifications: plan.map(p => ({
          id: p.id,
          title: p.title,
          body: p.body,
          ...(p.largeBody ? { largeBody: p.largeBody, summaryText: 'HomeMed' } : {}),
          channelId: CHANNEL_ID,
          smallIcon: SMALL_ICON,
          iconColor: ICON_COLOR,
          schedule: { at: p.at, allowWhileIdle: true },
          extra: { type: 'expiry', medicine_ids: p.medicineIds },
        })),
      })
    }
    return plan
  }
  const result = nativeQueue.then(run, run)
  nativeQueue = result.catch(() => {})
  return result
}

// Browser: show today's reminders when the app is opened (once per
// medicine/offset per day). Returns how many medicines were announced.
export async function showWebReminders(medicines, prefs, userKey) {
  if (!prefs.enabled || !prefs.days_before.length) return 0
  if ((await getNotificationPermission()) !== 'granted') return 0

  const today = new Date()
  const stamp = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const storeKey = `homemed_web_notified_${userKey}_${stamp}`
  let seen = new Set()
  try { seen = new Set(JSON.parse(localStorage.getItem(storeKey) || '[]')) } catch { /* ignore */ }

  const items = []
  const ids = []
  for (const m of medicines) {
    const expiry = parseLocalDate(m.data_validade)
    if (!expiry) continue
    const offset = Math.round((expiry - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000)
    if (!prefs.days_before.includes(offset)) continue
    const key = `${m.id}:${offset}`
    if (seen.has(key)) continue
    items.push({ name: medicineLabel(m), offset, expiry })
    ids.push(key)
  }
  if (!items.length) return 0

  const msg = buildMessage(items)
  await showWebNotification(msg.title, msg.largeBody || msg.body, 'expiry-summary')
  try { localStorage.setItem(storeKey, JSON.stringify([...seen, ...ids])) } catch { /* ignore */ }
  return items.length
}

async function showWebNotification(title, body, tag) {
  const options = { body, icon: '/icon-192.png', badge: '/icon-192.png', tag, data: { url: '/' } }
  const reg = await navigator.serviceWorker?.ready?.catch(() => null)
  if (reg) await reg.showNotification(title, options)
  else new Notification(title, options)
}

// "Send me a test" button: shows a sample in about two seconds.
export async function sendTestNotification() {
  const title = 'Tudo certo por aqui!'
  const body = 'É assim que os avisos de vencimento do HomeMed vão aparecer no seu celular.'
  if (isNativeApp()) {
    await ensureChannel()
    await LocalNotifications.schedule({
      notifications: [{
        id: TEST_ID,
        title,
        body,
        channelId: CHANNEL_ID,
        smallIcon: SMALL_ICON,
        iconColor: ICON_COLOR,
        schedule: { at: new Date(Date.now() + 2000), allowWhileIdle: true },
        extra: { type: 'test' },
      }],
    })
    return
  }
  await showWebNotification(title, body, 'homemed-test')
}

// Calls cb(extra) when the user taps one of our notifications. Returns an
// unsubscribe function.
export function onNotificationTap(cb) {
  if (!isNativeApp()) return () => {}
  let handle = null
  let cancelled = false
  LocalNotifications.addListener('localNotificationActionPerformed', (a) => cb(a.notification?.extra || {}))
    .then(h => { if (cancelled) h.remove(); else handle = h })
    .catch(() => {})
  return () => { cancelled = true; handle?.remove() }
}
