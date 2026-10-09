// "Farmácia de viagem": pure helpers (no browser APIs) so they can be tested.

const pad = (n) => String(n).padStart(2, '0')

// "2027-05-31" -> "31/05/2027" without going through UTC (which shows the day before in Brazil).
export function fmtBR(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

export function itemLabel(m) {
  return `${m.nome_comercial || 'Medicamento'}${m.concentracao ? ' ' + m.concentracao : ''}`
}

// Why an item should not (or may not) go on the trip: 'expired' | 'before_return' | null
// `today` and `returnDate` are 'YYYY-MM-DD' strings (compared as text, which orders correctly).
export function tripIssue(m, today, returnDate) {
  const v = String(m.data_validade || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  if (v < today) return 'expired'
  if (returnDate && v < returnDate) return 'before_return'
  return null
}

// items: [{ med, qty }]
export function buildTripText(items, { destination = '', returnDate = '' } = {}) {
  const head = `Farmácia de viagem${destination ? ' - ' + destination : ''}${returnDate ? ` (volta em ${fmtBR(returnDate)})` : ''}`
  const lines = items.map(({ med, qty }) => {
    const extras = [
      med.data_validade ? `val. ${fmtBR(med.data_validade)}` : null,
      med.precisa_receita ? 'levar receita' : null,
    ].filter(Boolean).join(', ')
    return `☐ ${itemLabel(med)} - ${qty} un.${extras ? ` (${extras})` : ''}`
  })
  return [head, '', ...lines, '', 'Feito com HomeMed AI'].join('\n')
}
