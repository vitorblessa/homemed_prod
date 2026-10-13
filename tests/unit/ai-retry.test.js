import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readBoxDates, AIUnavailableError } from '@/lib/ai'

const html502 = '<!DOCTYPE html><html><title>Error 502</title><p><b>502.</b> That’s an error.</p></html>'
const ok = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"lote":"A1","data_fabricacao":null,"data_validade":"2027-05-31"}' }] } }] }), { status: 200 })

describe('IA: falhas temporárias do Google', () => {
  beforeEach(() => { process.env.GEMINI_API_KEY = 'k'; process.env.AI_RETRY_DELAY_MS = '0' })
  afterEach(() => { vi.restoreAllMocks(); delete process.env.GEMINI_API_KEY })

  it('tenta de novo depois de um 502 e devolve o resultado', async () => {
    const f = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(html502, { status: 502 }))
      .mockResolvedValueOnce(ok())
    const r = await readBoxDates({ image_base64: 'abc' })
    expect(r.lote).toBe('A1')
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('depois de 3 falhas lança erro amigável, sem o HTML do Google', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(html502, { status: 502 }))
    const err = await readBoxDates({ image_base64: 'abc' }).catch(e => e)
    expect(err).toBeInstanceOf(AIUnavailableError)
    expect(err.message).not.toMatch(/<|DOCTYPE|502/)
    expect(err.detail).not.toMatch(/</)
    expect(f).toHaveBeenCalledTimes(3)
  })

  it('erro de pedido (400/403) não é repetido', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('bad key', { status: 403 }))
    await expect(readBoxDates({ image_base64: 'abc' })).rejects.toThrow(/403/)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('falha de rede também é repetida', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(ok())
    expect((await readBoxDates({ image_base64: 'abc' })).lote).toBe('A1')
    expect(f).toHaveBeenCalledTimes(2)
  })
})
