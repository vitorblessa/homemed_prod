import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createFakeDb } from '../helpers/fake-db'
import { call } from '../helpers/api'
import { scopeFilter, moveMedicinesToFamily, releaseFamilyMedicines, listMedicines, logHistory } from '@/lib/data/medicines'
import { createSession, findSession, consumeResetToken, SESSION_TTL_MS } from '@/lib/data/users'
import { matches } from '../helpers/fake-db'

let db
vi.mock('@/lib/mongo', () => ({ getDb: async () => db }))
const { GET, POST, PUT } = await import('@/app/api/[[...path]]/route.js')

beforeEach(() => { db = createFakeDb(); vi.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => vi.restoreAllMocks())

describe('scopeFilter', () => {
  it('sem família: só os medicamentos pessoais da pessoa', () => {
    const f = scopeFilter({ email: 'a@x.com', family_id: null })
    expect(matches({ user_email: 'a@x.com', family_id: null }, f)).toBe(true)
    expect(matches({ user_email: 'a@x.com' }, f)).toBe(true) // sem o campo family_id
    expect(matches({ user_email: 'b@x.com', family_id: null }, f)).toBe(false)
    expect(matches({ user_email: 'a@x.com', family_id: 'f1' }, f)).toBe(false) // já foi para a família
  })

  it('com família: tudo da família, de qualquer membro', () => {
    const f = scopeFilter({ email: 'a@x.com', family_id: 'f1' })
    expect(matches({ user_email: 'b@x.com', family_id: 'f1' }, f)).toBe(true)
    expect(matches({ user_email: 'a@x.com', family_id: 'f2' }, f)).toBe(false)
    expect(matches({ user_email: 'a@x.com', family_id: null }, f)).toBe(false)
  })
})

describe('medicamentos e família', () => {
  it('criar a família leva só os medicamentos pessoais; desfazer devolve', async () => {
    const meds = db.rows('medicines')
    meds.push(
      { id: '1', user_email: 'a@x.com', family_id: null },
      { id: '2', user_email: 'a@x.com' },
      { id: '3', user_email: 'a@x.com', family_id: 'outra' },
      { id: '4', user_email: 'b@x.com', family_id: null },
    )
    await moveMedicinesToFamily(db, 'a@x.com', 'f1')
    expect(meds.map(m => m.family_id)).toEqual(['f1', 'f1', 'outra', null])
    await releaseFamilyMedicines(db, 'f1')
    expect(meds.map(m => m.family_id)).toEqual([null, null, 'outra', null])
  })

  it('lista do mais novo para o mais antigo e aplica filtros extras', async () => {
    db.rows('medicines').push(
      { id: '1', user_email: 'a@x.com', family_id: null, created_at: '2026-01-01', categoria: 'X' },
      { id: '2', user_email: 'a@x.com', family_id: null, created_at: '2026-03-01', categoria: 'Y' },
    )
    const user = { email: 'a@x.com', family_id: null }
    expect((await listMedicines(db, user)).map(m => m.id)).toEqual(['2', '1'])
    expect((await listMedicines(db, user, { categoria: 'X' })).map(m => m.id)).toEqual(['1'])
  })

  it('o histórico ganha id e data sozinho, mas respeita a data informada', async () => {
    await logHistory(db, { medicine_id: 'm', action: 'created' })
    await logHistory(db, { medicine_id: 'm', action: 'added', created_at: '2026-01-01T00:00:00.000Z' })
    const [a, b] = db.rows('history')
    expect(a.id).toBeTruthy()
    expect(a.created_at).toBeTruthy()
    expect(b.created_at).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('sessões e redefinição', () => {
  it('a sessão dura 7 dias', async () => {
    const now = new Date('2026-10-09T12:00:00Z')
    const token = await createSession(db, { email: 'a@x.com', name: 'A', now })
    const s = await findSession(db, token)
    expect(new Date(s.expires_at).getTime() - now.getTime()).toBe(SESSION_TTL_MS)
    expect(SESSION_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('consumeResetToken é de uso único e respeita a validade', async () => {
    db.rows('users').push({ email: 'a@x.com', reset_token_hash: 'h', reset_expires_at: new Date(Date.now() + 60_000) })
    expect(await consumeResetToken(db, 'h', { password_hash: 'novo' })).toBeTruthy()
    expect(db.rows('users')[0].password_hash).toBe('novo')
    expect(db.rows('users')[0].reset_token_hash).toBeUndefined()
    expect(await consumeResetToken(db, 'h', { password_hash: 'outro' })).toBeNull()
    db.rows('users').push({ email: 'b@x.com', reset_token_hash: 'k', reset_expires_at: new Date(Date.now() - 1) })
    expect(await consumeResetToken(db, 'k', { password_hash: 'x' })).toBeNull()
  })
})

describe('preferências (/settings)', () => {
  let cookie
  beforeEach(async () => {
    cookie = (await call(POST, 'POST', '/auth/register', { body: { email: 'ana@example.com', password: 'segredo1' } })).cookie
  })

  it('exige login', async () => {
    expect((await call(GET, 'GET', '/settings')).status).toBe(401)
  })

  it('devolve padrões para quem nunca configurou', async () => {
    const r = await call(GET, 'GET', '/settings', { cookie })
    expect(r.data).toMatchObject({ tour_completed: false, theme: null })
    expect(r.data.notifications).toMatchObject({ enabled: true, hour: 9, low_stock: true })
  })

  it('guarda qualquer subconjunto e devolve na próxima leitura', async () => {
    expect((await call(PUT, 'PUT', '/settings', { cookie, body: { theme: 'dark' } })).data).toEqual({ theme: 'dark' })
    await call(PUT, 'PUT', '/settings', { cookie, body: { tour_completed: true, notifications: { hour: 7, low_stock: false } } })
    const r = (await call(GET, 'GET', '/settings', { cookie })).data
    expect(r).toMatchObject({ theme: 'dark', tour_completed: true })
    expect(r.notifications).toMatchObject({ hour: 7, low_stock: false })
  })

  it('recusa corpo vazio ou valores inválidos', async () => {
    expect((await call(PUT, 'PUT', '/settings', { cookie, body: {} })).status).toBe(400)
    expect((await call(PUT, 'PUT', '/settings', { cookie, body: { theme: 'roxo' } })).status).toBe(400)
  })
})
