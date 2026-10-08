// Dose-time reminders ("hora de tomar"). Pure helpers shared by the API
// (validation) and the app (screen + scheduling).
//
// The feature is OFF unless NEXT_PUBLIC_DOSE_REMINDERS=true is set at build
// time: it moves the app closer to a "health" app, so it must not reach
// Play testers before that decision is made on purpose.

export const DOSE_REMINDERS_ENABLED = process.env.NEXT_PUBLIC_DOSE_REMINDERS === 'true'
export const MAX_DOSE_TIMES = 6

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export function isValidTime(t) {
  return typeof t === 'string' && TIME_RE.test(t)
}

// Whatever came from the network/database -> sorted, unique 'HH:MM' list.
export function normalizeDoseTimes(raw) {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter(isValidTime))].sort().slice(0, MAX_DOSE_TIMES)
}

function label(m) {
  return `${m.nome_comercial || 'Medicamento'}${m.concentracao ? ' ' + m.concentracao : ''}`
}

// One entry per medicine+time, earliest first: [{ key, id, name, time }]
export function dosesForDay(medicines) {
  const out = []
  for (const m of medicines || []) {
    for (const time of normalizeDoseTimes(m.dose_times)) {
      out.push({ key: `${m.id}@${time}`, id: m.id, name: label(m), time })
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name, 'pt-BR'))
}

// Groups the day's doses by time: [{ time, hour, minute, names: [...], ids: [...] }]
export function buildDoseSlots(medicines) {
  const slots = new Map()
  for (const d of dosesForDay(medicines)) {
    if (!slots.has(d.time)) {
      slots.set(d.time, { time: d.time, hour: Number(d.time.slice(0, 2)), minute: Number(d.time.slice(3)), names: [], ids: [] })
    }
    const s = slots.get(d.time)
    s.names.push(d.name)
    s.ids.push(d.id)
  }
  return [...slots.values()]
}

export function buildDoseMessage(slot) {
  if (slot.names.length === 1) {
    return { title: 'Hora do remédio', body: `${slot.names[0]} — ${slot.time}.` }
  }
  const shown = slot.names.slice(0, 2).join(', ')
  const rest = slot.names.length - 2
  return {
    title: `Hora de ${slot.names.length} remédios`,
    body: rest > 0 ? `${shown} e mais ${rest}.` : `${slot.names.join(' e ')}.`,
    largeBody: slot.names.slice(0, 8).map(n => `• ${n}`).join('\n'),
  }
}

// Daily repeating notifications. ids 100000+HHMM: clear of the expiry ids
// (YYYYMMDD, ~20 million), the test id (1) and the low-stock id (2).
export function buildDoseReminders(medicines) {
  return buildDoseSlots(medicines).map(s => ({
    id: 100000 + s.hour * 100 + s.minute,
    hour: s.hour,
    minute: s.minute,
    medicineIds: s.ids,
    ...buildDoseMessage(s),
  }))
}
