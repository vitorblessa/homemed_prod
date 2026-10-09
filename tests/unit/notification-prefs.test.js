import { describe, it, expect } from 'vitest'
import { DEFAULT_NOTIFICATION_PREFS, HOUR_MAX, HOUR_MIN, normalizeNotificationPrefs } from '@/lib/notification-prefs'

describe('normalizeNotificationPrefs', () => {
  it('lixo vira o padrão', () => {
    for (const raw of [undefined, null, 'x', 42, [], {}]) {
      expect(normalizeNotificationPrefs(raw)).toEqual(DEFAULT_NOTIFICATION_PREFS)
    }
  })

  it('padrão: avisos ligados, 30/7/0 dias, 9h, estoque baixo ligado', () => {
    expect(DEFAULT_NOTIFICATION_PREFS).toEqual({ enabled: true, days_before: [30, 7, 0], hour: 9, low_stock: true })
  })

  it('mantém valores válidos', () => {
    expect(normalizeNotificationPrefs({ enabled: false, days_before: [1, 15], hour: 20, low_stock: false }))
      .toEqual({ enabled: false, days_before: [15, 1], hour: 20, low_stock: false })
  })

  it('remove dias inválidos e repetidos e ordena do maior para o menor', () => {
    const r = normalizeNotificationPrefs({ days_before: [0, '7', 7, 99, -1, 'x', 30, 1.5] })
    expect(r.days_before).toEqual([30, 7, 0])
  })

  it('aceita lista vazia (usuário desmarcou tudo)', () => {
    expect(normalizeNotificationPrefs({ days_before: [] }).days_before).toEqual([])
  })

  it('horário fora do intervalo volta ao padrão', () => {
    expect(normalizeNotificationPrefs({ hour: HOUR_MIN - 1 }).hour).toBe(9)
    expect(normalizeNotificationPrefs({ hour: HOUR_MAX + 1 }).hour).toBe(9)
    expect(normalizeNotificationPrefs({ hour: 7.5 }).hour).toBe(9)
    expect(normalizeNotificationPrefs({ hour: HOUR_MIN }).hour).toBe(HOUR_MIN)
    expect(normalizeNotificationPrefs({ hour: HOUR_MAX }).hour).toBe(HOUR_MAX)
  })

  it('booleanos só valem se forem booleanos', () => {
    const r = normalizeNotificationPrefs({ enabled: 'false', low_stock: 0 })
    expect(r.enabled).toBe(true)
    expect(r.low_stock).toBe(true)
  })
})
