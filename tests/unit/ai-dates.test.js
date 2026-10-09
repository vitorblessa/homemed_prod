import { describe, it, expect } from 'vitest'
import { describeExpiry, todayBR } from '@/lib/ai'

describe('describeExpiry (o que o assistente de IA recebe sobre validade)', () => {
  const today = '2026-10-09'
  it('vencido', () => expect(describeExpiry('2026-10-07', today)).toBe('validade 07/10/2026 (VENCIDO há 2 dias)'))
  it('vencido há 1 dia (singular)', () => expect(describeExpiry('2026-10-08', today)).toBe('validade 08/10/2026 (VENCIDO há 1 dia)'))
  it('vence hoje', () => expect(describeExpiry('2026-10-09', today)).toBe('validade 09/10/2026 (vence HOJE)'))
  it('válido', () => expect(describeExpiry('2026-10-10', today)).toBe('validade 10/10/2026 (válido, vence em 1 dia)'))
  it('sem data ou data inválida', () => {
    expect(describeExpiry('', today)).toBe('validade não informada')
    expect(describeExpiry('lixo', today)).toBe('validade não informada')
  })
  it('todayBR devolve AAAA-MM-DD', () => expect(todayBR()).toMatch(/^\d{4}-\d{2}-\d{2}$/))
})
