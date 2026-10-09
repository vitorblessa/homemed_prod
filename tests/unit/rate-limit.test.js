import { describe, it, expect } from 'vitest'
import { clear, clientIp, hit, tooManyMessage } from '@/lib/rate-limit'

// Banco falso mínimo: guarda contadores por _id, como o findOneAndUpdate com upsert do Mongo.
function fakeDb({ failing = false } = {}) {
  const docs = new Map()
  const col = {
    createIndex: async () => 'ok',
    findOneAndUpdate: async (filter, update) => {
      if (failing) throw new Error('mongo fora do ar')
      const cur = docs.get(filter._id) || { _id: filter._id, ...update.$setOnInsert, count: 0 }
      cur.count += update.$inc.count
      docs.set(filter._id, cur)
      return { value: cur } // formato do driver 5; o código também aceita o do driver 6
    },
    deleteOne: async (filter) => { docs.delete(filter._id) },
  }
  return { collection: () => col, docs }
}

const MIN = 60_000
const T0 = Date.UTC(2026, 9, 9, 12, 0, 0)

describe('hit', () => {
  it('permite até o limite e bloqueia depois', async () => {
    const db = fakeDb()
    for (let i = 0; i < 5; i++) expect((await hit(db, 'login:ip', 5, 15 * MIN, T0)).allowed).toBe(true)
    const sixth = await hit(db, 'login:ip', 5, 15 * MIN, T0)
    expect(sixth.allowed).toBe(false)
    expect(sixth.retryAfterSec).toBeGreaterThan(0)
    expect(sixth.retryAfterSec).toBeLessThanOrEqual(15 * 60)
  })

  it('chaves diferentes não se misturam', async () => {
    const db = fakeDb()
    await hit(db, 'a', 1, MIN, T0)
    expect((await hit(db, 'b', 1, MIN, T0)).allowed).toBe(true)
    expect((await hit(db, 'a', 1, MIN, T0)).allowed).toBe(false)
  })

  it('a janela seguinte começa do zero', async () => {
    const db = fakeDb()
    await hit(db, 'a', 1, MIN, T0)
    expect((await hit(db, 'a', 1, MIN, T0)).allowed).toBe(false)
    expect((await hit(db, 'a', 1, MIN, T0 + MIN)).allowed).toBe(true)
  })

  it('o tempo de espera diminui ao longo da janela', async () => {
    const db = fakeDb()
    await hit(db, 'a', 1, 10 * MIN, T0)
    const early = await hit(db, 'a', 1, 10 * MIN, T0 + 1000)
    const late = await hit(db, 'a', 1, 10 * MIN, T0 + 5 * MIN)
    expect(late.retryAfterSec).toBeLessThan(early.retryAfterSec)
  })

  it('se o contador falhar, deixa passar (não tranca todo mundo)', async () => {
    expect(await hit(fakeDb({ failing: true }), 'a', 1, MIN, T0)).toEqual({ allowed: true, retryAfterSec: 0 })
  })
})

describe('clear', () => {
  it('zera a janela atual (ex.: login certo)', async () => {
    const db = fakeDb()
    await hit(db, 'a', 1, MIN, T0)
    await clear(db, 'a', MIN, T0)
    expect((await hit(db, 'a', 1, MIN, T0)).allowed).toBe(true)
  })
})

describe('mensagens e IP', () => {
  it('tooManyMessage arredonda para cima e pluraliza', () => {
    expect(tooManyMessage(1)).toBe('Muitas tentativas. Tente novamente em 1 minuto.')
    expect(tooManyMessage(61)).toBe('Muitas tentativas. Tente novamente em 2 minutos.')
  })

  it('clientIp prefere x-real-ip, depois o primeiro de x-forwarded-for', () => {
    const req = (h) => ({ headers: { get: (k) => h[k] ?? null } })
    expect(clientIp(req({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }))).toBe('1.1.1.1')
    expect(clientIp(req({ 'x-forwarded-for': '2.2.2.2, 3.3.3.3' }))).toBe('2.2.2.2')
    expect(clientIp(req({}))).toBe('unknown')
  })
})
