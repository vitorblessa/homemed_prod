import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createFakeDb } from '../helpers/fake-db'
import { call } from '../helpers/api'

let db
vi.mock('@/lib/mongo', () => ({ getDb: async () => db }))

const { GET, POST, PATCH, DELETE } = await import('@/app/api/[[...path]]/route.js')
const H = { GET, POST, PATCH, DELETE }
const api = (method) => (path, body, o = {}) => call(H[method], method, path, { body, ...o })
const get = (p, o) => call(GET, 'GET', p, o)
const post = api('POST'), patch = api('PATCH'), del = api('DELETE')

async function signup(email) {
  const r = await call(POST, 'POST', '/auth/register', { body: { email, password: 'segredo1', name: email.split('@')[0] } })
  return r.cookie
}

let ana, beto
beforeEach(async () => {
  db = createFakeDb()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  ana = await signup('ana@example.com')
  beto = await signup('beto@example.com')
})
afterEach(() => vi.restoreAllMocks())

const med = (over = {}) => ({ nome_comercial: 'Dipirona', data_validade: '2099-01-31', quantidade: 3, quantidade_minima: 1, ...over })

describe('acesso', () => {
  it('rotas de dados exigem login', async () => {
    expect((await get('/medicines')).status).toBe(401)
    expect((await post('/medicines', med())).status).toBe(401)
    expect((await get('/stats')).status).toBe(401)
  })
})

describe('medicamentos', () => {
  it('cadastra com padrões, calcula o status e registra no histórico', async () => {
    const r = await post('/medicines', { nome_comercial: 'Dipirona', data_validade: '2099-01-31' }, { cookie: ana })
    expect(r.status).toBe(200)
    expect(r.data).toMatchObject({ quantidade: 1, quantidade_minima: 1, categoria: 'Outros', forma_farmaceutica: 'Comprimido', expiry_status: 'ok', dose_times: [] })
    expect(db.rows('history')[0]).toMatchObject({ action: 'created', medicine_id: r.data.id })
  })

  it('normaliza os horários de dose ao cadastrar', async () => {
    const r = await post('/medicines', med({ dose_times: ['20:00', '08:00', '08:00', 'lixo'] }), { cookie: ana })
    expect(r.data.dose_times).toEqual(['08:00', '20:00'])
  })

  it('marca vencido pelo dia de Brasília', async () => {
    const r = await post('/medicines', med({ data_validade: '2000-01-01' }), { cookie: ana })
    expect(r.data.expiry_status).toBe('expired')
  })

  it('cada pessoa só enxerga, edita e apaga os próprios medicamentos', async () => {
    const mine = (await post('/medicines', med(), { cookie: ana })).data
    expect((await get('/medicines', { cookie: beto })).data.medicines).toHaveLength(0)
    expect((await get('/medicines/' + mine.id, { cookie: beto })).status).toBe(404)
    expect((await patch('/medicines/' + mine.id, { quantidade: 99 }, { cookie: beto })).status).toBe(404)
    await del('/medicines/' + mine.id, undefined, { cookie: beto })
    expect(db.rows('medicines')).toHaveLength(1)
    expect(db.rows('medicines')[0].quantidade).toBe(3)
    expect((await get('/medicines', { cookie: ana })).data.medicines).toHaveLength(1)
  })

  it('busca por texto e filtra por categoria', async () => {
    await post('/medicines', med({ nome_comercial: 'Dipirona', categoria: 'Analgésico' }), { cookie: ana })
    await post('/medicines', med({ nome_comercial: 'Allegra', categoria: 'Antialérgico' }), { cookie: ana })
    expect((await get('/medicines?q=alleg', { cookie: ana })).data.medicines.map(m => m.nome_comercial)).toEqual(['Allegra'])
    expect((await get('/medicines?categoria=Analg%C3%A9sico', { cookie: ana })).data.medicines).toHaveLength(1)
  })

  it('PATCH ignora campos protegidos e registra a mudança de quantidade', async () => {
    const m = (await post('/medicines', med(), { cookie: ana })).data
    const r = await patch('/medicines/' + m.id, { quantidade: 1, user_email: 'beto@example.com', id: 'outro' }, { cookie: ana })
    expect(r.data.id).toBe(m.id)
    expect(r.data.user_email).toBe('ana@example.com')
    expect(db.rows('history').at(-1)).toMatchObject({ action: 'removed' })
    expect(db.rows('history').at(-1).details).toContain('-2')
  })

  it('o resumo da bula não é aceito do app e some quando o remédio muda', async () => {
    const m = (await post('/medicines', med(), { cookie: ana })).data
    db.rows('medicines')[0].bula_resumo = { resumo: 'x' }
    await patch('/medicines/' + m.id, { bula_resumo: { resumo: 'forjado' }, observacoes: 'ok' }, { cookie: ana })
    expect(db.rows('medicines')[0].bula_resumo).toEqual({ resumo: 'x' })
    await patch('/medicines/' + m.id, { concentracao: '500mg' }, { cookie: ana })
    expect(db.rows('medicines')[0].bula_resumo).toBeUndefined()
  })

  it('estatísticas contam vencidos, estoque baixo e categorias', async () => {
    await post('/medicines', med({ data_validade: '2000-01-01', categoria: 'Analgésico' }), { cookie: ana })
    await post('/medicines', med({ quantidade: 1, quantidade_minima: 2 }), { cookie: ana })
    const s = (await get('/stats', { cookie: ana })).data
    expect(s).toMatchObject({ total: 2, expired: 1, low_stock: 1 })
    expect(s.categories).toEqual({ Analgésico: 1, Outros: 1 })
  })
})

describe('família', () => {
  it('quem cria a família leva os medicamentos pessoais; quem entra passa a ver os da família', async () => {
    await post('/medicines', med({ nome_comercial: 'DaAna' }), { cookie: ana })
    await post('/medicines', med({ nome_comercial: 'DoBeto' }), { cookie: beto })
    const fam = (await post('/families', { name: 'Casa' }, { cookie: ana })).data.family
    expect(fam.invite_code).toBeTruthy()
    // antes de entrar, o Beto só vê o dele
    expect((await get('/medicines', { cookie: beto })).data.medicines.map(m => m.nome_comercial)).toEqual(['DoBeto'])
    expect((await post('/families/join', { invite_code: fam.invite_code.toLowerCase() }, { cookie: beto })).status).toBe(200)
    const seen = (await get('/medicines', { cookie: beto })).data.medicines.map(m => m.nome_comercial)
    expect(seen).toEqual(['DaAna'])
    // novo cadastro do Beto vai para a família e a Ana enxerga
    await post('/medicines', med({ nome_comercial: 'Novo' }), { cookie: beto })
    expect((await get('/medicines', { cookie: ana })).data.medicines.map(m => m.nome_comercial).sort()).toEqual(['DaAna', 'Novo'])
  })

  it('código inválido não entra; já estando numa família não cria outra', async () => {
    expect((await post('/families/join', { invite_code: 'NADA' }, { cookie: beto })).status).toBe(404)
    await post('/families', {}, { cookie: ana })
    expect((await post('/families', {}, { cookie: ana })).status).toBe(400)
  })

  it('só o dono gera novo código e remove membros', async () => {
    const fam = (await post('/families', {}, { cookie: ana })).data.family
    await post('/families/join', { invite_code: fam.invite_code }, { cookie: beto })
    expect((await post('/families/regenerate-code', {}, { cookie: beto })).status).toBe(403)
    expect((await del('/families/members/ana%40example.com', undefined, { cookie: beto })).status).toBe(403)
    const novo = await post('/families/regenerate-code', {}, { cookie: ana })
    expect(novo.data.invite_code).not.toBe(fam.invite_code)
    expect((await del('/families/members/beto%40example.com', undefined, { cookie: ana })).status).toBe(200)
  })

  it('o último a sair desfaz a família e devolve os medicamentos ao pessoal', async () => {
    await post('/medicines', med(), { cookie: ana })
    await post('/families', {}, { cookie: ana })
    expect((await post('/families/leave', {}, { cookie: ana })).status).toBe(200)
    expect(db.rows('families')).toHaveLength(0)
    expect(db.rows('medicines')[0].family_id).toBeNull()
    expect((await get('/medicines', { cookie: ana })).data.medicines).toHaveLength(1)
  })
})
