import { describe, it, expect } from 'vitest'
import {
  buildLowStockReminder, buildLowStockReminders, buildMessage, buildNotificationPlan, isLowStock, medicineLabel, parseLocalDate,
} from '@/lib/notifications'

const prefs = { enabled: true, days_before: [30, 7, 0], hour: 9, low_stock: true }
const NOW = new Date(2026, 9, 9, 8, 0, 0) // 09/10/2026 08:00 local (TZ fixo no script de teste)
const med = (id, nome, validade, extra = {}) => ({ id, nome_comercial: nome, data_validade: validade, ...extra })

describe('parseLocalDate', () => {
  it('não desloca para o dia anterior', () => {
    const d = parseLocalDate('2026-10-20')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 20])
    expect(d.getHours()).toBe(0)
  })
  it('devolve null para vazio ou lixo', () => {
    expect(parseLocalDate('')).toBeNull()
    expect(parseLocalDate(null)).toBeNull()
    expect(parseLocalDate('abc')).toBeNull()
  })
})

describe('medicineLabel', () => {
  it('junta nome e concentração', () => {
    expect(medicineLabel({ nome_comercial: 'Novalgina', concentracao: '500mg' })).toBe('Novalgina 500mg')
    expect(medicineLabel({})).toBe('Medicamento')
  })
})

describe('buildNotificationPlan', () => {
  it('uma notificação por dia, com a hora escolhida', () => {
    const plan = buildNotificationPlan([med('a', 'Dipirona', '2026-12-01')], prefs, NOW)
    // 30 dias antes (01/11), 7 dias antes (24/11) e no dia (01/12)
    expect(plan.map(p => p.at.getDate() + '/' + (p.at.getMonth() + 1))).toEqual(['1/11', '24/11', '1/12'])
    expect(plan.every(p => p.at.getHours() === 9 && p.at.getMinutes() === 0)).toBe(true)
  })

  it('agrupa remédios do mesmo dia numa só notificação', () => {
    const plan = buildNotificationPlan(
      [med('a', 'Dipirona', '2026-12-01'), med('b', 'Loratadina', '2026-12-01')],
      { ...prefs, days_before: [0] }, NOW,
    )
    expect(plan).toHaveLength(1)
    expect(plan[0].count).toBe(2)
    expect(plan[0].medicineIds).toEqual(['a', 'b'])
    expect(plan[0].title).toMatch(/2 medicamentos/)
  })

  it('ignora o que já passou, inclusive hoje depois da hora do aviso', () => {
    const late = new Date(2026, 9, 9, 10, 0, 0)
    expect(buildNotificationPlan([med('a', 'X', '2026-10-09')], { ...prefs, days_before: [0] }, late)).toEqual([])
    expect(buildNotificationPlan([med('a', 'X', '2026-10-09')], { ...prefs, days_before: [0] }, NOW)).toHaveLength(1)
  })

  it('desligado ou sem dias escolhidos não agenda nada', () => {
    const meds = [med('a', 'X', '2026-12-01')]
    expect(buildNotificationPlan(meds, { ...prefs, enabled: false }, NOW)).toEqual([])
    expect(buildNotificationPlan(meds, { ...prefs, days_before: [] }, NOW)).toEqual([])
    expect(buildNotificationPlan(meds, null, NOW)).toEqual([])
  })

  it('ignora remédio sem validade ou com data inválida', () => {
    expect(buildNotificationPlan([med('a', 'X', ''), med('b', 'Y', 'lixo'), { id: 'c' }], prefs, NOW)).toEqual([])
  })

  it('respeita o limite, ficando com os avisos mais próximos', () => {
    const meds = Array.from({ length: 10 }, (_, i) => med('m' + i, 'M' + i, `2027-01-${String(i + 1).padStart(2, '0')}`))
    const plan = buildNotificationPlan(meds, { ...prefs, days_before: [0] }, NOW, 3)
    expect(plan).toHaveLength(3)
    expect(plan[0].at < plan[2].at).toBe(true)
  })

  it('usa a data como id (AAAAMMDD), único por dia', () => {
    const plan = buildNotificationPlan([med('a', 'X', '2026-12-01')], { ...prefs, days_before: [0] }, NOW)
    expect(plan[0].id).toBe(20261201)
  })
})

describe('buildMessage', () => {
  const exp = new Date(2026, 11, 1)
  it('texto de um item conforme a proximidade', () => {
    expect(buildMessage([{ name: 'X', offset: 0, expiry: exp }]).title).toBe('Medicamento vence hoje')
    expect(buildMessage([{ name: 'X', offset: 1, expiry: exp }]).title).toBe('Medicamento vence amanhã')
    expect(buildMessage([{ name: 'X', offset: 7, expiry: exp }]).body).toBe('X vence em 7 dias (01/12).')
  })
  it('vários itens: resumo e lista detalhada', () => {
    const items = ['A', 'B', 'C'].map((name, i) => ({ name, offset: i, expiry: exp }))
    const m = buildMessage(items)
    expect(m.title).toBe('3 medicamentos precisam de atenção')
    expect(m.body).toBe('A (hoje), B (amanhã) e mais 1.')
    expect(m.largeBody.split('\n')).toHaveLength(3)
  })
})

describe('estoque baixo', () => {
  const low = med('a', 'Dipirona', '2027-01-01', { quantidade: 1, quantidade_minima: 1 })
  const ok = med('b', 'Loratadina', '2027-01-01', { quantidade: 5, quantidade_minima: 1 })

  it('isLowStock: igual ou abaixo do mínimo; sem dados não conta', () => {
    expect(isLowStock(low)).toBe(true)
    expect(isLowStock({ quantidade: 0, quantidade_minima: 2 })).toBe(true)
    expect(isLowStock(ok)).toBe(false)
    expect(isLowStock({ quantidade: 1 })).toBe(false)
    expect(isLowStock({ quantidade_minima: 1 })).toBe(false)
    expect(isLowStock({ quantidade: '1', quantidade_minima: '2' })).toBe(true)
  })

  it('agenda para hoje se a hora ainda não passou, senão amanhã', () => {
    expect(buildLowStockReminder([low], prefs, NOW).at.getDate()).toBe(9)
    expect(buildLowStockReminder([low], prefs, new Date(2026, 9, 9, 10, 0)).at.getDate()).toBe(10)
  })

  it('nada a avisar ou opção desligada: null', () => {
    expect(buildLowStockReminder([ok], prefs, NOW)).toBeNull()
    expect(buildLowStockReminder([low], { ...prefs, low_stock: false }, NOW)).toBeNull()
  })

  it('agenda o aviso de estoque baixo para vários dias seguidos, com ids distintos', () => {
    const list = buildLowStockReminders([low], prefs, NOW)
    expect(list).toHaveLength(7)
    expect(new Set(list.map(r => r.id)).size).toBe(7)
    expect(list.map(r => r.at.getDate())).toEqual([9, 10, 11, 12, 13, 14, 15])
    expect(buildLowStockReminders([ok], prefs, NOW)).toEqual([])
  })

  it('mensagem para um e para vários', () => {
    expect(buildLowStockReminder([low], prefs, NOW).title).toBe('Estoque baixo')
    const two = buildLowStockReminder([low, med('c', 'Zinco', '', { quantidade: 0, quantidade_minima: 1 })], prefs, NOW)
    expect(two.title).toBe('2 medicamentos com estoque baixo')
  })
})
