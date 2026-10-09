import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createFakeDb } from '../helpers/fake-db'
import { call } from '../helpers/api'

let db
vi.mock('@/lib/mongo', () => ({ getDb: async () => db }))

process.env.RESEND_API_KEY = 'test-key'
process.env.APP_URL = 'https://app.test'

const { GET, POST, DELETE } = await import('@/app/api/[[...path]]/route.js')
const api = {
  get: (p, o) => call(GET, 'GET', p, o),
  post: (p, body, o) => call(POST, 'POST', p, { body, ...o }),
  del: (p, body, o) => call(DELETE, 'DELETE', p, { body, ...o }),
}

let emails
beforeEach(() => {
  db = createFakeDb()
  emails = []
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    if (String(url).includes('resend.com')) {
      emails.push(JSON.parse(init.body))
      return { ok: true, status: 200, text: async () => '' }
    }
    throw new Error('fetch inesperado: ' + url)
  }))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

const newUser = (over = {}) => ({ email: 'ana@example.com', password: 'segredo1', name: 'Ana', ...over })
const resetTokenFromEmail = () => emails.at(-1).text.match(/\?reset=([0-9a-f]+)/)[1]

describe('cadastro', () => {
  it('recusa e-mail inválido e senha curta', async () => {
    expect((await api.post('/auth/register', newUser({ email: 'sem-arroba' }))).status).toBe(400)
    expect((await api.post('/auth/register', newUser({ password: '123' }))).status).toBe(400)
  })

  it('cria a conta, guarda só o hash da senha e já entra', async () => {
    const r = await api.post('/auth/register', newUser())
    expect(r.status).toBe(200)
    expect(r.cookie).toBeTruthy()
    const user = db.rows('users')[0]
    expect(user.password_hash).toBeTruthy()
    expect(user.password_hash).not.toContain('segredo1')
    const me = await api.get('/auth/me', { cookie: r.cookie })
    expect(me.data.user.email).toBe('ana@example.com')
  })

  it('normaliza o e-mail e recusa duplicado', async () => {
    await api.post('/auth/register', newUser({ email: '  ANA@Example.com ' }))
    expect(db.rows('users')[0].email).toBe('ana@example.com')
    expect((await api.post('/auth/register', newUser())).status).toBe(409)
  })
})

describe('login', () => {
  beforeEach(async () => { await api.post('/auth/register', newUser()) })

  it('entra com a senha certa', async () => {
    const r = await api.post('/auth/login', { email: 'ANA@example.com', password: 'segredo1' })
    expect(r.status).toBe(200)
    expect(r.cookie).toBeTruthy()
  })

  it('responde igual para senha errada e para conta inexistente', async () => {
    const wrong = await api.post('/auth/login', { email: 'ana@example.com', password: 'errada' })
    const ghost = await api.post('/auth/login', { email: 'ninguem@example.com', password: 'segredo1' })
    expect(wrong.status).toBe(401)
    expect(ghost.status).toBe(401)
    expect(wrong.data.error).toBe(ghost.data.error)
    expect(wrong.cookie).toBeNull()
  })

  it('exige e-mail e senha', async () => {
    expect((await api.post('/auth/login', { email: 'ana@example.com' })).status).toBe(400)
  })

  it('bloqueia a conta depois de 8 tentativas erradas, mesmo vindo de IPs diferentes', async () => {
    for (let i = 0; i < 8; i++) {
      const r = await api.post('/auth/login', { email: 'ana@example.com', password: 'errada' }, { ip: `10.1.0.${i}` })
      expect(r.status).toBe(401)
    }
    const blocked = await api.post('/auth/login', { email: 'ana@example.com', password: 'segredo1' }, { ip: '10.1.0.99' })
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBeTruthy()
  })

  it('um login correto zera o contador de erros da conta', async () => {
    for (let i = 0; i < 7; i++) await api.post('/auth/login', { email: 'ana@example.com', password: 'errada' }, { ip: `10.2.0.${i}` })
    expect((await api.post('/auth/login', { email: 'ana@example.com', password: 'segredo1' }, { ip: '10.2.1.1' })).status).toBe(200)
    for (let i = 0; i < 7; i++) {
      expect((await api.post('/auth/login', { email: 'ana@example.com', password: 'errada' }, { ip: `10.2.2.${i}` })).status).toBe(401)
    }
  })

  it('reativa uma conta desativada ao entrar', async () => {
    const first = await api.post('/auth/login', { email: 'ana@example.com', password: 'segredo1' })
    await api.post('/auth/deactivate', {}, { cookie: first.cookie })
    expect(db.rows('users')[0].deactivated).toBe(true)
    await api.post('/auth/login', { email: 'ana@example.com', password: 'segredo1' })
    expect(db.rows('users')[0].deactivated).toBe(false)
    expect(db.rows('users')[0].deactivated_at).toBeUndefined()
  })
})

describe('sessão', () => {
  it('sem cookie, /auth/me devolve user nulo', async () => {
    expect((await api.get('/auth/me')).data.user).toBeNull()
  })

  it('cookie desconhecido ou sessão expirada não autentica', async () => {
    expect((await api.get('/auth/me', { cookie: 'inventado' })).data.user).toBeNull()
    const r = await api.post('/auth/register', newUser())
    db.rows('sessions')[0].expires_at = new Date(Date.now() - 1000)
    expect((await api.get('/auth/me', { cookie: r.cookie })).data.user).toBeNull()
  })

  it('logout apaga a sessão', async () => {
    const r = await api.post('/auth/register', newUser())
    await api.post('/auth/logout', {}, { cookie: r.cookie })
    expect(db.rows('sessions')).toHaveLength(0)
    expect((await api.get('/auth/me', { cookie: r.cookie })).data.user).toBeNull()
  })
})

describe('esqueci a senha', () => {
  beforeEach(async () => { await api.post('/auth/register', newUser()) })

  it('responde igual para conta existente e inexistente, e só envia e-mail para a existente', async () => {
    const ghost = await api.post('/auth/forgot-password', { email: 'ninguem@example.com' })
    expect(emails).toHaveLength(0)
    const real = await api.post('/auth/forgot-password', { email: 'ana@example.com' })
    expect(emails).toHaveLength(1)
    expect(real.status).toBe(200)
    expect(real.data).toEqual(ghost.data)
    expect(emails[0].to).toBe('ana@example.com')
  })

  it('guarda só o hash do token, nunca o token', async () => {
    await api.post('/auth/forgot-password', { email: 'ana@example.com' })
    const token = resetTokenFromEmail()
    const user = db.rows('users')[0]
    expect(user.reset_token_hash).toBeTruthy()
    expect(user.reset_token_hash).not.toBe(token)
    expect(JSON.stringify(user)).not.toContain(token)
    expect(emails[0].text).toContain('https://app.test/?reset=' + token)
  })

  it('não manda dois e-mails no mesmo minuto', async () => {
    await api.post('/auth/forgot-password', { email: 'ana@example.com' })
    await api.post('/auth/forgot-password', { email: 'ana@example.com' })
    expect(emails).toHaveLength(1)
  })

  it('pede um e-mail válido', async () => {
    expect((await api.post('/auth/forgot-password', { email: 'x' })).status).toBe(400)
  })
})

describe('redefinir a senha', () => {
  let token
  beforeEach(async () => {
    await api.post('/auth/register', newUser())
    await api.post('/auth/forgot-password', { email: 'ana@example.com' })
    token = resetTokenFromEmail()
  })

  it('troca a senha: a nova entra e a antiga não', async () => {
    const r = await api.post('/auth/reset-password', { token, password: 'novasenha9' })
    expect(r.status).toBe(200)
    expect((await api.post('/auth/login', { email: 'ana@example.com', password: 'novasenha9' })).status).toBe(200)
    expect((await api.post('/auth/login', { email: 'ana@example.com', password: 'segredo1' })).status).toBe(401)
  })

  it('o link só vale uma vez', async () => {
    await api.post('/auth/reset-password', { token, password: 'novasenha9' })
    const again = await api.post('/auth/reset-password', { token, password: 'outrasenha' })
    expect(again.status).toBe(400)
  })

  it('derruba todas as sessões abertas da conta', async () => {
    const s = await api.post('/auth/login', { email: 'ana@example.com', password: 'segredo1' })
    expect((await api.get('/auth/me', { cookie: s.cookie })).data.user).toBeTruthy()
    await api.post('/auth/reset-password', { token, password: 'novasenha9' })
    expect((await api.get('/auth/me', { cookie: s.cookie })).data.user).toBeNull()
  })

  it('recusa token inventado, vazio ou expirado', async () => {
    expect((await api.post('/auth/reset-password', { token: 'abc', password: 'novasenha9' })).status).toBe(400)
    expect((await api.post('/auth/reset-password', { password: 'novasenha9' })).status).toBe(400)
    db.rows('users')[0].reset_expires_at = new Date(Date.now() - 1000)
    expect((await api.post('/auth/reset-password', { token, password: 'novasenha9' })).status).toBe(400)
  })

  it('recusa senha curta sem gastar o link', async () => {
    expect((await api.post('/auth/reset-password', { token, password: '123' })).status).toBe(400)
    expect((await api.post('/auth/reset-password', { token, password: 'novasenha9' })).status).toBe(200)
  })
})

describe('desativar e excluir conta', () => {
  it('desativar exige estar logado e encerra as sessões', async () => {
    expect((await api.post('/auth/deactivate', {})).status).toBe(401)
    const r = await api.post('/auth/register', newUser())
    expect((await api.post('/auth/deactivate', {}, { cookie: r.cookie })).status).toBe(200)
    expect(db.rows('sessions')).toHaveLength(0)
  })

  it('excluir pede o e-mail digitado e apaga conta, sessões e medicamentos', async () => {
    const r = await api.post('/auth/register', newUser())
    db.rows('medicines').push({ id: 'm1', user_email: 'ana@example.com' }, { id: 'm2', user_email: 'outra@example.com' })
    const wrong = await api.del('/auth/account', { confirm_email: 'errado@example.com' }, { cookie: r.cookie })
    expect(wrong.status).toBe(400)
    expect(db.rows('users')).toHaveLength(1)
    const ok = await api.del('/auth/account', { confirm_email: 'ANA@example.com' }, { cookie: r.cookie })
    expect(ok.status).toBe(200)
    expect(db.rows('users')).toHaveLength(0)
    expect(db.rows('sessions')).toHaveLength(0)
    expect(db.rows('medicines').map(m => m.id)).toEqual(['m2'])
  })

  it('sem login, excluir devolve 401', async () => {
    expect((await api.del('/auth/account', { confirm_email: 'ana@example.com' })).status).toBe(401)
  })
})
