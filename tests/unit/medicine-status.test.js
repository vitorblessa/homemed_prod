import { describe, it, expect } from 'vitest'
import { computeStatus, daysUntil, todayBR } from '@/lib/medicine-status'

// 2026-10-09 12:00 in Brasília
const NOON = new Date('2026-10-09T15:00:00Z')

describe('daysUntil', () => {
  it('conta dias inteiros a partir de hoje', () => {
    expect(daysUntil('2026-10-09', NOON)).toBe(0)
    expect(daysUntil('2026-10-10', NOON)).toBe(1)
    expect(daysUntil('2026-10-08', NOON)).toBe(-1)
    expect(daysUntil('2027-10-09', NOON)).toBe(365)
  })

  it('usa o dia de Brasília, não o do servidor (UTC)', () => {
    // 22:30 do dia 9 em Brasília já é dia 10 em UTC
    const night = new Date('2026-10-10T01:30:00Z')
    expect(todayBR(night)).toBe('2026-10-09')
    expect(daysUntil('2026-10-09', night)).toBe(0) // vence hoje, ainda não vencido
    expect(daysUntil('2026-10-10', night)).toBe(1)
  })

  it('não desloca datas "AAAA-MM-DD" pelo fuso', () => {
    const earlyMorning = new Date('2026-10-09T03:30:00Z') // 00:30 em Brasília
    expect(daysUntil('2026-10-09', earlyMorning)).toBe(0)
  })

  it('aceita data com hora e ignora lixo', () => {
    expect(daysUntil('2026-10-12T00:00:00.000Z', NOON)).toBe(3)
    expect(daysUntil('', NOON)).toBeNull()
    expect(daysUntil(null, NOON)).toBeNull()
    expect(daysUntil('isso não é data', NOON)).toBeNull()
  })

  it('lida com virada de mês e ano bissexto', () => {
    const feb = new Date('2028-02-28T15:00:00Z')
    expect(daysUntil('2028-02-29', feb)).toBe(1)
    expect(daysUntil('2028-03-01', feb)).toBe(2)
  })
})

describe('computeStatus', () => {
  const at = (date) => computeStatus({ data_validade: date }, NOON).expiry_status

  it('classifica nos limites exatos', () => {
    expect(at('2026-10-08')).toBe('expired')
    expect(at('2026-10-09')).toBe('critical') // vence hoje ainda vale
    expect(at('2026-10-16')).toBe('critical') // +7
    expect(at('2026-10-17')).toBe('warning_30') // +8
    expect(at('2026-11-08')).toBe('warning_30') // +30
    expect(at('2026-11-09')).toBe('warning_60') // +31
    expect(at('2026-12-08')).toBe('warning_60') // +60
    expect(at('2026-12-09')).toBe('warning_90') // +61
    expect(at('2027-01-07')).toBe('warning_90') // +90
    expect(at('2027-01-08')).toBe('ok') // +91
  })

  it('sem validade fica "unknown"', () => {
    expect(computeStatus({}, NOON)).toEqual({ expiry_status: 'unknown', days_until_expiry: null })
  })

  it('devolve também os dias', () => {
    expect(computeStatus({ data_validade: '2026-10-19' }, NOON)).toEqual({ expiry_status: 'warning_30', days_until_expiry: 10 })
  })
})
