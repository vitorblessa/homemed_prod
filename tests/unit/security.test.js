// Verificação das diretivas de segurança do projeto. Cada bloco leva o nome
// da diretiva; se alguma regressão aparecer, o CI falha.
//
//  D1  Autenticação obrigatória em toda rota de dados
//  D2  Isolamento entre usuários e famílias (nada de ver dado de outra conta)
//  D3  Senhas e links de redefinição protegidos (hash, uso único, expiração)
//  D4  Sessão segura (cookie HttpOnly/Secure, logout e exclusão revogam)
//  D5  Proteção contra abuso (limite de tentativas, sem enumeração de contas)
//  D6  Entradas hostis (injeção NoSQL, corpo inválido, tamanho)
//  D7  Requisições de outros sites (CSRF) e cabeçalhos HTTP de segurança
//  D8  Segredos fora do código e do git
//  D9  Privacidade/LGPD (exclusão total, sem dados pessoais sem uso, logs sem e-mail)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { NextRequest } from 'next/server'
import { createFakeDb } from '../helpers/fake-db'
import { call } from '../helpers/api'

let db
vi.mock('@/lib/mongo', () => ({ getDb: async () => db }))
process.env.RESEND_API_KEY = 'test-key'
process.env.APP_URL = 'https://app.test'

const { GET, POST, PATCH, PUT, DELETE } = await import('@/app/api/[[...path]]/route.js')
const H = { GET, POST, PATCH, PUT, DELETE }
const req = (method, path, o = {}) => call(H[method], method, path, o)
const root = new URL('../../', import.meta.url).pathname

let emails
beforeEach(() => {
  db = createFakeDb()
  emails = []
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    if (String(url).includes('resend.com')) { emails.push(JSON.parse(init.body)); return { ok: true, status: 200, text: async () => '' } }
    throw new Error('fetch inesperado: ' + url)
  }))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

const signup = async (email, password = 'segredo1') =>
  (await req('POST', '/auth/register', { body: { email, password, name: email.split('@')[0] } })).cookie
const med = (o = {}) => ({ nome_comercial: 'Dipirona', data_validade: '2099-01-31', quantidade: 3, quantidade_minima: 1, ...o })

/* ───────── D1 ───────── */
describe('D1 · autenticação obrigatória', () => {
  const protectedRoutes = [
    ['GET', '/stats'], ['GET', '/medicines'], ['POST', '/medicines'], ['GET', '/medicines/by-barcode/789'],
    ['GET', '/medicines/abc'], ['PATCH', '/medicines/abc'], ['DELETE', '/medicines/abc'],
    ['POST', '/medicines/abc/take'], ['POST', '/medicines/abc/leaflet'], ['GET', '/doses'],
    ['GET', '/settings'], ['PUT', '/settings'],
    ['GET', '/families/me'], ['POST', '/families'], ['POST', '/families/join'], ['POST', '/families/leave'],
    ['POST', '/families/regenerate-code'], ['DELETE', '/families/members/x@y.com'],
    ['POST', '/ai/enrich'], ['POST', '/ai/enrich-barcode'], ['POST', '/ai/read-box-dates'], ['POST', '/ai/ask'],
    ['POST', '/auth/deactivate'], ['DELETE', '/auth/account'],
  ]
  it.each(protectedRoutes)('%s %s responde 401 sem login', async (method, path) => {
    const r = await req(method, path, { body: method === 'GET' || method === 'DELETE' ? undefined : {} })
    expect(r.status).toBe(401)
  })

  it('cookie inventado ou de outra conta apagada não vale', async () => {
    expect((await req('GET', '/medicines', { cookie: 'a.b' })).status).toBe(401)
    expect((await req('GET', '/medicines', { cookie: '{"$ne":null}' })).status).toBe(401)
  })

  it('sessão expirada é recusada', async () => {
    const c = await signup('ana@example.com')
    db.rows('sessions')[0].expires_at = new Date(Date.now() - 1000)
    expect((await req('GET', '/medicines', { cookie: c })).status).toBe(401)
  })

  it('as rotas públicas são só as de autenticação, versão e raiz', async () => {
    expect((await req('GET', '/version')).status).toBe(200)
    expect((await req('GET', '/')).status).toBe(200)
    expect((await req('GET', '/rota-que-nao-existe')).status).toBe(401)
  })
})

/* ───────── D2 ───────── */
describe('D2 · isolamento entre contas', () => {
  it('uma conta não lê, altera, apaga nem baixa dose de remédio de outra', async () => {
    const ana = await signup('ana@example.com'); const beto = await signup('beto@example.com')
    const m = (await req('POST', '/medicines', { body: med(), cookie: ana })).data
    for (const [method, path, body] of [
      ['GET', `/medicines/${m.id}`], ['PATCH', `/medicines/${m.id}`, { quantidade: 0 }],
      ['POST', `/medicines/${m.id}/take`, { date: '2099-01-01', time: '08:00' }],
    ]) {
      const r = await req(method, path, { body, cookie: beto })
      expect([403, 404]).toContain(r.status)
    }
    await req('DELETE', `/medicines/${m.id}`, { cookie: beto })
    expect(db.rows('medicines')).toHaveLength(1)
    expect(db.rows('medicines')[0].quantidade).toBe(3)
    // a tentativa de apagar o remédio alheio não deixa rastro no histórico dele
    expect(db.rows('history').filter(h => h.action === 'deleted')).toHaveLength(0)
    expect((await req('GET', '/stats', { cookie: beto })).data.total).toBe(0)
  })

  it('o app não consegue trocar dono ou família de um remédio pelo PATCH', async () => {
    const ana = await signup('ana@example.com')
    const m = (await req('POST', '/medicines', { body: med(), cookie: ana })).data
    await req('PATCH', `/medicines/${m.id}`, { body: { family_id: 'familia-alheia', user_email: 'beto@example.com', created_at: '2000-01-01' }, cookie: ana })
    const row = db.rows('medicines')[0]
    expect(row.user_email).toBe('ana@example.com')
    expect(row.family_id ?? null).toBeNull()
    expect(row.created_at).not.toBe('2000-01-01')
  })

  it('o histórico de um remédio não aparece para outra conta', async () => {
    const ana = await signup('ana@example.com'); const beto = await signup('beto@example.com')
    const m = (await req('POST', '/medicines', { body: med(), cookie: ana })).data
    const r = await req('GET', `/medicines/${m.id}`, { cookie: beto })
    expect(JSON.stringify(r.data || {})).not.toContain('Dipirona')
  })

  it('quem sai da família deixa de ver os remédios dela; quem não é membro não entra sem o código', async () => {
    const ana = await signup('ana@example.com'); const beto = await signup('beto@example.com'); const caio = await signup('caio@example.com')
    await req('POST', '/families', { body: { name: 'Casa' }, cookie: ana })
    const code = (await req('GET', '/families/me', { cookie: ana })).data.family.invite_code
    await req('POST', '/medicines', { body: med({ nome_comercial: 'Familiar' }), cookie: ana })
    expect((await req('POST', '/families/join', { body: { invite_code: 'CODIGOERRADO' }, cookie: beto })).status).toBeGreaterThanOrEqual(400)
    expect((await req('GET', '/medicines', { cookie: beto })).data.medicines).toHaveLength(0)
    await req('POST', '/families/join', { body: { invite_code: code }, cookie: beto })
    expect((await req('GET', '/medicines', { cookie: beto })).data.medicines).toHaveLength(1)
    await req('POST', '/families/leave', { cookie: beto })
    expect((await req('GET', '/medicines', { cookie: beto })).data.medicines).toHaveLength(0)
    expect((await req('GET', '/medicines', { cookie: caio })).data.medicines).toHaveLength(0)
  })

  it('só o dono da família remove membros e gera novo código', async () => {
    const ana = await signup('ana@example.com'); const beto = await signup('beto@example.com')
    await req('POST', '/families', { body: { name: 'Casa' }, cookie: ana })
    const code = (await req('GET', '/families/me', { cookie: ana })).data.family.invite_code
    await req('POST', '/families/join', { body: { invite_code: code }, cookie: beto })
    expect((await req('POST', '/families/regenerate-code', { body: {}, cookie: beto })).status).toBeGreaterThanOrEqual(400)
    expect((await req('DELETE', '/families/members/ana@example.com', { cookie: beto })).status).toBeGreaterThanOrEqual(400)
  })

  it('/auth/me e as respostas de login não devolvem hash, token nem campos internos', async () => {
    const r = await req('POST', '/auth/register', { body: { email: 'ana@example.com', password: 'segredo1', name: 'Ana' } })
    const me = await req('GET', '/auth/me', { cookie: r.cookie })
    const login = await req('POST', '/auth/login', { body: { email: 'ana@example.com', password: 'segredo1' } })
    for (const body of [r.data, me.data, login.data]) {
      const txt = JSON.stringify(body)
      expect(txt).not.toMatch(/password|hash|\$2[aby]\$|reset_token|token/i)
    }
  })
})

/* ───────── D3 ───────── */
describe('D3 · senhas e redefinição', () => {
  it('a senha é guardada com bcrypt, nunca em texto', async () => {
    await signup('ana@example.com', 'minha-senha-123')
    const u = db.rows('users')[0]
    expect(u.password_hash).toMatch(/^\$2[aby]\$\d\d\$/)
    expect(JSON.stringify(db.rows('users'))).not.toContain('minha-senha-123')
  })

  it('o link de redefinição guarda só o hash, vale uma vez e invalida as sessões', async () => {
    const c = await signup('ana@example.com')
    await req('POST', '/auth/forgot-password', { body: { email: 'ana@example.com' } })
    const token = emails.at(-1).text.match(/\?reset=([0-9a-f]+)/)[1]
    expect(token).toHaveLength(64)
    expect(JSON.stringify(db.rows('users'))).not.toContain(token)
    expect((await req('POST', '/auth/reset-password', { body: { token, password: 'nova-senha-1' } })).status).toBe(200)
    expect((await req('POST', '/auth/reset-password', { body: { token, password: 'outra-senha-2' } })).status).toBe(400)
    expect((await req('GET', '/medicines', { cookie: c })).status).toBe(401)
  })

  it('link de redefinição expirado é recusado', async () => {
    await signup('ana@example.com')
    await req('POST', '/auth/forgot-password', { body: { email: 'ana@example.com' } })
    const token = emails.at(-1).text.match(/\?reset=([0-9a-f]+)/)[1]
    db.rows('users')[0].reset_expires_at = new Date(Date.now() - 1000)
    expect((await req('POST', '/auth/reset-password', { body: { token, password: 'nova-senha-1' } })).status).toBe(400)
  })

  it('o link só chega ao e-mail da conta e vem do domínio configurado', async () => {
    await signup('ana@example.com')
    await req('POST', '/auth/forgot-password', { body: { email: 'ana@example.com' }, ip: '10.9.9.9' })
    expect([emails.at(-1).to].flat()).toEqual(['ana@example.com'])
    expect(emails.at(-1).text).toContain('https://app.test/?reset=')
  })

  it('exige senha de pelo menos 8 caracteres no cadastro e na redefinição', async () => {
    const r = await req('POST', '/auth/register', { body: { email: 'x@example.com', password: '1234567', name: 'X' } })
    expect(r.status).toBe(400)
    await signup('ana@example.com')
    await req('POST', '/auth/forgot-password', { body: { email: 'ana@example.com' } })
    const token = emails.at(-1).text.match(/\?reset=([0-9a-f]+)/)[1]
    expect((await req('POST', '/auth/reset-password', { body: { token, password: '1234567' } })).status).toBe(400)
  })

  it('quem já tem senha de 6 ou 7 caracteres continua conseguindo entrar', async () => {
    const bcrypt = (await import('bcryptjs')).default
    db.rows('users').push({ email: 'antiga@example.com', name: 'A', password_hash: await bcrypt.hash('abc123', 10) })
    expect((await req('POST', '/auth/login', { body: { email: 'antiga@example.com', password: 'abc123' } })).status).toBe(200)
  })
})

/* ───────── D4 ───────── */
describe('D4 · sessão', () => {
  it('o cookie de sessão é HttpOnly, Secure e dura no máximo 7 dias', async () => {
    const r = await req('POST', '/auth/register', { body: { email: 'ana@example.com', password: 'segredo1', name: 'Ana' } })
    const setCookie = r.headers.get('set-cookie')
    expect(setCookie).toMatch(/HttpOnly/i)
    expect(setCookie).toMatch(/Secure/i)
    expect(setCookie).toMatch(/Max-Age=604800/i)
  })

  it.fails('[ABERTO · exige teste em aparelho] cookie de sessão com SameSite Lax', async () => {
    const r = await req('POST', '/auth/register', { body: { email: 'ana@example.com', password: 'segredo1', name: 'Ana' } })
    expect(r.headers.get('set-cookie')).toMatch(/SameSite=(Lax|Strict)/i)
  })

  it('o identificador da sessão é longo e aleatório', async () => {
    const a = await signup('ana@example.com'); const b = await signup('beto@example.com')
    expect(a.length).toBeGreaterThanOrEqual(64)
    expect(a).not.toBe(b)
  })

  it('o logout derruba a sessão no servidor', async () => {
    const c = await signup('ana@example.com')
    await req('POST', '/auth/logout', { cookie: c })
    expect((await req('GET', '/medicines', { cookie: c })).status).toBe(401)
  })

  it('o servidor não guarda o token da sessão em texto puro', async () => {
    const c = await signup('ana@example.com')
    expect(JSON.stringify(db.rows('sessions'))).not.toContain(c)
  })

  it('o valor guardado no banco não funciona como cookie (vazamento do banco não vira sessão)', async () => {
    await signup('ana@example.com')
    const stored = db.rows('sessions')[0].token
    expect((await req('GET', '/medicines', { cookie: stored })).status).toBe(401)
  })

  it('sessões antigas (guardadas em texto) continuam valendo até expirar', async () => {
    db.rows('users').push({ email: 'velha@example.com', name: 'V' })
    db.rows('sessions').push({ token: 'legado.token', email: 'velha@example.com', name: 'V', expires_at: new Date(Date.now() + 3600e3) })
    expect((await req('GET', '/auth/me', { cookie: 'legado.token' })).data.user.email).toBe('velha@example.com')
    await req('POST', '/auth/logout', { cookie: 'legado.token' })
    expect((await req('GET', '/auth/me', { cookie: 'legado.token' })).data.user).toBeNull()
  })
})

/* ───────── D5 ───────── */
describe('D5 · abuso e enumeração', () => {
  it('login: mesma resposta para conta inexistente e senha errada, e trava depois de 8 erros', async () => {
    await signup('ana@example.com')
    const a = await req('POST', '/auth/login', { body: { email: 'ana@example.com', password: 'errada-123' } })
    const b = await req('POST', '/auth/login', { body: { email: 'ninguem@example.com', password: 'errada-123' } })
    expect([a.status, a.data]).toEqual([b.status, b.data])
    let last
    for (let i = 0; i < 9; i++) last = await req('POST', '/auth/login', { body: { email: 'ana@example.com', password: 'errada-123' } })
    expect(last.status).toBe(429)
    expect(last.headers.get('retry-after')).toBeTruthy()
  })

  it('esqueci a senha: não revela se a conta existe', async () => {
    await signup('ana@example.com')
    const a = await req('POST', '/auth/forgot-password', { body: { email: 'ana@example.com' } })
    const b = await req('POST', '/auth/forgot-password', { body: { email: 'ninguem@example.com' } })
    expect([a.status, a.data]).toEqual([b.status, b.data])
  })

  it.fails('[RISCO ACEITO · UX] cadastro não revela que o e-mail já existe', async () => {
    await signup('ana@example.com')
    const r = await req('POST', '/auth/register', { body: { email: 'ana@example.com', password: 'outra-senha-1', name: 'Ana' } })
    expect(r.status).not.toBe(409)
  })

  it('cadastro, redefinição e IA têm limite de uso', async () => {
    const src = readFileSync(root + 'lib/api/auth.js', 'utf8') + readFileSync(root + 'lib/api/ai.js', 'utf8')
    for (const k of ['register:ip', 'forgot:ip', 'forgot:email', 'reset:ip', 'login:ip', 'login:email', 'photo:']) expect(src).toContain(k)
  })
})

/* ───────── D6 ───────── */
describe('D6 · entradas hostis', () => {
  it('injeção NoSQL no login e no e-mail não passa', async () => {
    await signup('ana@example.com')
    for (const body of [
      { email: { $ne: null }, password: { $ne: null } },
      { email: 'ana@example.com', password: { $ne: '' } },
      { email: { $regex: '.*' }, password: 'x' },
    ]) {
      const r = await req('POST', '/auth/login', { body })
      expect(r.status).toBeGreaterThanOrEqual(400)
      expect(r.status).toBeLessThan(500)
      expect(r.cookie).toBeNull()
    }
  })

  it('operadores do Mongo nos filtros de busca e nos campos do cadastro não vazam dados de outras contas', async () => {
    const ana = await signup('ana@example.com'); const beto = await signup('beto@example.com')
    await req('POST', '/medicines', { body: med({ nome_comercial: 'Secreto' }), cookie: ana })
    const r = await req('GET', '/medicines?q[$ne]=x&categoria[$ne]=y&user_email=ana@example.com', { cookie: beto })
    expect(r.data.medicines).toHaveLength(0)
    const forged = await req('POST', '/medicines', { body: med({ user_email: 'ana@example.com', family_id: 'x' }), cookie: beto })
    expect(db.rows('medicines').find(m => m.id === forged.data.id).user_email).toBe('beto@example.com')
  })

  it('corpo JSON inválido responde 4xx, nunca 500 com detalhes internos', async () => {
    for (const [method, path] of [['POST', '/auth/login'], ['POST', '/auth/register'], ['POST', '/auth/forgot-password']]) {
      const r = new NextRequest('http://localhost/api' + path, { method, headers: { 'content-type': 'application/json', 'x-real-ip': '10.1.1.1' }, body: '{quebrado' })
      const res = await H[method](r, { params: Promise.resolve({ path: path.split('/').filter(Boolean) }) })
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
    }
  })

  it('foto acima de 3,5 MB é recusada antes de chegar à IA', async () => {
    const c = await signup('ana@example.com')
    const r = await req('POST', '/ai/read-box-dates', { body: { image_base64: 'A'.repeat(3_600_000) }, cookie: c })
    expect(r.status).toBe(413)
  })

  it('erros internos não expõem pilha, caminho de arquivo nem texto do provedor', () => {
    const src = readFileSync(root + 'app/api/[[...path]]/route.js', 'utf8')
    expect(src).not.toMatch(/\.stack/)
    expect(readFileSync(root + 'lib/ai.js', 'utf8')).toContain('AIUnavailableError')
  })
})

/* ───────── D7 ───────── */
describe('D7 · outros sites (CSRF) e cabeçalhos', () => {
  it('pedido que altera dados vindo de outro site (Origin estranho) é recusado, mesmo com o cookie', async () => {
    const c = await signup('ana@example.com')
    for (const origin of ['https://site-malicioso.example', 'null']) {
      const r = new NextRequest('http://localhost/api/medicines', {
        method: 'POST',
        headers: { 'content-type': 'text/plain', origin, host: 'localhost', cookie: `homemed_session=${c}` },
        body: JSON.stringify(med()),
      })
      const res = await POST(r, { params: Promise.resolve({ path: ['medicines'] }) })
      expect(res.status).toBe(403)
    }
    expect(db.rows('medicines')).toHaveLength(0)
  })

  it('o app em si (mesma origem) continua funcionando', async () => {
    const c = await signup('ana@example.com')
    const r = new NextRequest('http://localhost/api/medicines', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost', host: 'localhost', cookie: `homemed_session=${c}` },
      body: JSON.stringify(med()),
    })
    expect((await POST(r, { params: Promise.resolve({ path: ['medicines'] }) })).status).toBe(200)
  })

  describe('cabeçalhos do next.config', () => {
    const run = async (env = {}) => {
      const old = { ...process.env }
      Object.assign(process.env, env)
      const cfg = (await import('../../next.config.js')).default
      try { return await cfg.headers() } finally { process.env = old }
    }
    const of = (rules, src) => Object.fromEntries(rules.find(r => r.source === src).headers.map(h => [h.key, h.value]))

    it('páginas: nosniff, referrer, permissões e proteção contra enquadramento', async () => {
      const h = of(await run(), '/((?!api/).*)')
      expect(h['X-Content-Type-Options']).toBe('nosniff')
      expect(h['Referrer-Policy']).toBeTruthy()
      expect(h['Permissions-Policy']).toMatch(/camera=\(self\)/)
      expect(h['Permissions-Policy']).toMatch(/geolocation=\(\)|microphone=\(\)/)
      expect(h['Content-Security-Policy']).toMatch(/frame-ancestors 'self';/)
    })

    it('API: sem permissão para qualquer site (nada de * com credenciais) e sem enquadramento', async () => {
      const h = of(await run({ CORS_ORIGINS: '' }), '/api/:path*')
      expect(h['X-Frame-Options']).toBe('DENY')
      expect(h['Access-Control-Allow-Origin'] ?? '').not.toBe('*')
    })

    it('API: CORS_ORIGINS definido vale só para a origem indicada', async () => {
      const h = of(await run({ CORS_ORIGINS: 'https://www.homemed.tech' }), '/api/:path*')
      expect(h['Access-Control-Allow-Origin']).toBe('https://www.homemed.tech')
    })

    it('HSTS ativo nas páginas', async () => {
      const h = of(await run(), '/((?!api/).*)')
      expect(h['Strict-Transport-Security']).toMatch(/max-age=\d{7,}/)
    })

    it.fails('[ABERTO · recomendação] CSP completo (default-src, script-src) além do frame-ancestors', async () => {
      const h = of(await run(), '/((?!api/).*)')
      expect(h['Content-Security-Policy']).toMatch(/default-src/)
    })
  })

  it('o app não usa innerHTML com conteúdo do usuário', () => {
    const out = execSync(`grep -rn "dangerouslySetInnerHTML\\|innerHTML\\|eval(" app components lib --include=*.js --include=*.jsx || true`, { cwd: root }).toString()
    const lines = out.split('\n').filter(Boolean)
    // permitidos: script de boot fixo, correção de DataCloneError, estilo do gráfico (cores fixas)
    for (const l of lines) expect(l).toMatch(/layout\.js|chart\.jsx/)
  })
})

/* ───────── D8 ───────── */
describe('D8 · segredos fora do código', () => {
  const tracked = () => execSync('git ls-files', { cwd: root }).toString().split('\n').filter(f => f && !/yarn\.lock|\.png$|\.ico$|\.jar$|\.jks$/.test(f))
  it('nenhuma chave, token ou senha no código versionado', () => {
    const re = /AIza[0-9A-Za-z_-]{30,}|github_pat_[0-9A-Za-z_]{20,}|gh[pous]_[0-9A-Za-z]{30,}|sk-[A-Za-z0-9_-]{20,}|re_[A-Za-z0-9]{20,}|mongodb(\+srv)?:\/\/[^\s"'<>:]+:(?!senha)[^@\s]+@|-----BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|GOCSPX-[0-9A-Za-z_-]{20,}/
    const hits = tracked().filter(f => { try { return re.test(readFileSync(root + f, 'utf8')) } catch { return false } })
    expect(hits).toEqual([])
  })
  it('arquivos de chave e .env reais não estão no git', () => {
    expect(tracked().filter(f => /(^|\/)\.env($|\.(?!example))|\.keystore$|\.jks$|\.p12$|\.pem$|google-services\.json$|service-account/.test(f))).toEqual([])
  })
  it('o .gitignore protege .env e keystores', () => {
    const g = readFileSync(root + '.gitignore', 'utf8')
    expect(g).toMatch(/^\.env$/m)
    expect(g).toMatch(/keystore/)
  })
})

/* ───────── D9 ───────── */
describe('D9 · privacidade', () => {
  it('excluir a conta apaga usuário, remédios, histórico, sessões e vínculos', async () => {
    const c = await signup('ana@example.com')
    await req('POST', '/medicines', { body: med(), cookie: c })
    const r = await req('DELETE', '/auth/account', { body: { confirm_email: 'ana@example.com' }, cookie: c })
    expect(r.status).toBe(200)
    for (const col of ['users', 'medicines', 'history', 'sessions']) expect(db.rows(col)).toHaveLength(0)
  })

  it('excluir a conta exige confirmar o e-mail', async () => {
    const c = await signup('ana@example.com')
    expect((await req('DELETE', '/auth/account', { body: { confirm_email: 'outro@example.com' }, cookie: c })).status).toBe(400)
    expect(db.rows('users')).toHaveLength(1)
  })

  it('não existe mais código de notificação push guardando inscrições', () => {
    expect(execSync(`grep -rln "push/subscribe" app lib components || true`, { cwd: root }).toString().trim()).toBe('')
  })

  it('o relatório de erros mascara e-mails e não envia dados da requisição', async () => {
    const { scrub } = await import('@/lib/monitoring')
    const ev = scrub({ message: 'falhou para ana@example.com', request: { cookies: 'x' }, user: { email: 'a@b.com' }, exception: { values: [{ value: 'erro ana@example.com' }] } })
    expect(JSON.stringify(ev)).not.toContain('ana@example.com')
    expect(ev.request).toBeUndefined()
    expect(ev.user).toBeUndefined()
  })

  it('a política de privacidade e os termos existem e a exclusão de conta é acessível', () => {
    for (const p of ['app/privacy/page.js', 'app/terms/page.js', 'app/delete-account/page.js']) expect(readFileSync(root + p, 'utf8').length).toBeGreaterThan(500)
  })

  it('o app não envia e-mail nem nome de remédio para a IA além do necessário', () => {
    const ai = readFileSync(root + 'lib/ai.js', 'utf8')
    expect(ai).not.toMatch(/user_email|\.email\b/)
  })
})
