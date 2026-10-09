import { describe, it, expect, vi } from 'vitest'
import {
  MAX_DOSE_TIMES, buildDoseMessage, buildDoseReminders, buildDoseSlots, dosesForDay, isValidTime, normalizeDoseTimes,
} from '@/lib/doses'

const meds = [
  { id: 'a', nome_comercial: 'Losartana', concentracao: '50mg', dose_times: ['20:00', '08:00'] },
  { id: 'b', nome_comercial: 'Vitamina D', dose_times: ['08:00'] },
  { id: 'c', nome_comercial: 'Sem horário' },
]

describe('horários', () => {
  it('isValidTime só aceita HH:MM de 00:00 a 23:59', () => {
    for (const t of ['00:00', '08:30', '23:59']) expect(isValidTime(t)).toBe(true)
    for (const t of ['24:00', '8:00', '08:60', '0800', '', null, 800]) expect(isValidTime(t)).toBe(false)
  })

  it('normalizeDoseTimes: válidos, sem repetir, em ordem, no máximo 6', () => {
    expect(normalizeDoseTimes(['20:00', '08:00', '8:00', '25:00', '08:00', null])).toEqual(['08:00', '20:00'])
    expect(normalizeDoseTimes('x')).toEqual([])
    expect(normalizeDoseTimes(undefined)).toEqual([])
    expect(normalizeDoseTimes(['01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00'])).toHaveLength(MAX_DOSE_TIMES)
  })
})

describe('doses do dia', () => {
  it('lista por horário e depois por nome, ignorando quem não tem horário', () => {
    const d = dosesForDay(meds)
    expect(d.map(x => `${x.time} ${x.name}`)).toEqual(['08:00 Losartana 50mg', '08:00 Vitamina D', '20:00 Losartana 50mg'])
    expect(d[0].key).toBe('a@08:00')
  })

  it('agrupa por horário', () => {
    const slots = buildDoseSlots(meds)
    expect(slots.map(s => [s.time, s.names.length])).toEqual([['08:00', 2], ['20:00', 1]])
    expect(slots[0]).toMatchObject({ hour: 8, minute: 0, ids: ['a', 'b'] })
  })

  it('notificações diárias com id previsível e sem colidir com os outros avisos', () => {
    const r = buildDoseReminders(meds)
    expect(r.map(x => x.id)).toEqual([100800, 102000])
    for (const x of r) {
      expect(x.id).toBeGreaterThan(2) // teste (1) e estoque baixo (2)
      expect(x.id).toBeLessThan(20000101) // ids de vencimento são AAAAMMDD
    }
    expect(r[0].title).toBe('Hora de 2 remédios')
    expect(r[1].title).toBe('Hora do remédio')
    expect(r[1].body).toContain('Losartana 50mg')
  })

  it('mensagem com muitos remédios resume', () => {
    const slot = { time: '08:00', names: ['A', 'B', 'C', 'D'] }
    const m = buildDoseMessage(slot)
    expect(m.body).toBe('A, B e mais 2.')
    expect(m.largeBody.split('\n')).toHaveLength(4)
  })
})

describe('chave do recurso', () => {
  it('fica desligado por padrão', async () => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_DOSE_REMINDERS', '')
    const m = await import('@/lib/doses')
    expect(m.DOSE_REMINDERS_ENABLED).toBe(false)
  })

  it('liga só com "true"', async () => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_DOSE_REMINDERS', 'true')
    expect((await import('@/lib/doses')).DOSE_REMINDERS_ENABLED).toBe(true)
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_DOSE_REMINDERS', '1')
    expect((await import('@/lib/doses')).DOSE_REMINDERS_ENABLED).toBe(false)
    vi.unstubAllEnvs()
  })
})
