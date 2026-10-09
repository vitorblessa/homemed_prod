import { describe, it, expect } from 'vitest'
import { buildTripText, fmtBR, itemLabel, tripIssue } from '@/lib/travel'

describe('fmtBR', () => {
  it('formata sem passar pelo fuso (não vira o dia anterior)', () => {
    expect(fmtBR('2028-01-01')).toBe('01/01/2028')
    expect(fmtBR('2027-05-31T00:00:00.000Z')).toBe('31/05/2027')
  })
  it('vazio ou inválido: texto vazio', () => {
    expect(fmtBR('')).toBe('')
    expect(fmtBR(null)).toBe('')
    expect(fmtBR('abc')).toBe('')
  })
})

describe('tripIssue', () => {
  const today = '2026-10-09'
  it('vencido', () => expect(tripIssue({ data_validade: '2026-10-08' }, today, '')).toBe('expired'))
  it('vence hoje ainda vale', () => expect(tripIssue({ data_validade: '2026-10-09' }, today, '')).toBeNull())
  it('vence antes da volta', () => expect(tripIssue({ data_validade: '2026-10-20' }, today, '2026-11-01')).toBe('before_return'))
  it('vence no dia da volta: ok', () => expect(tripIssue({ data_validade: '2026-11-01' }, today, '2026-11-01')).toBeNull())
  it('sem data de volta, só o vencido conta', () => expect(tripIssue({ data_validade: '2026-10-20' }, today, '')).toBeNull())
  it('sem validade: sem problema', () => expect(tripIssue({}, today, '2026-11-01')).toBeNull())
})

describe('buildTripText', () => {
  it('monta cabeçalho e itens', () => {
    const t = buildTripText(
      [{ med: { nome_comercial: 'Dipirona', concentracao: '500mg', data_validade: '2027-05-31', precisa_receita: true }, qty: 2 },
       { med: { nome_comercial: 'Soro' }, qty: 1 }],
      { destination: 'Salvador', returnDate: '2026-11-01' },
    )
    expect(t.split('\n')).toEqual([
      'Farmácia de viagem - Salvador (volta em 01/11/2026)',
      '',
      '☐ Dipirona 500mg - 2 un. (val. 31/05/2027, levar receita)',
      '☐ Soro - 1 un.',
      '',
      'Feito com HomeMed AI',
    ])
  })
  it('sem destino nem volta', () => {
    expect(buildTripText([], {}).split('\n')[0]).toBe('Farmácia de viagem')
  })
  it('itemLabel', () => expect(itemLabel({})).toBe('Medicamento'))
})
