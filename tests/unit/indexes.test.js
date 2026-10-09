import { describe, it, expect, vi } from 'vitest'

async function load() {
  vi.resetModules()
  return import('@/lib/indexes')
}

describe('INDEXES', () => {
  it('e-mail do usuário e token de sessão são únicos', async () => {
    const { INDEXES } = await load()
    const find = (c, k) => INDEXES.find(([col, keys]) => col === c && JSON.stringify(keys) === JSON.stringify(k))
    expect(find('users', { email: 1 })[2].unique).toBe(true)
    expect(find('sessions', { token: 1 })[2].unique).toBe(true)
  })

  it('sessões expiradas saem sozinhas (TTL)', async () => {
    const { INDEXES } = await load()
    const ttl = INDEXES.find(([c, k]) => c === 'sessions' && k.expires_at)
    expect(ttl[2].expireAfterSeconds).toBe(0)
  })

  it('não há índice repetido', async () => {
    const { INDEXES } = await load()
    const keys = INDEXES.map(([c, k]) => c + JSON.stringify(k))
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('ensureIndexes', () => {
  function db(failOn) {
    const created = []
    return {
      created,
      dropped: [],
      collection(name) {
        return {
          drop: async () => { throw new Error('ns not found') }, // coleção já não existe: deve ser ignorado
          createIndex: async (keys) => {
            if (failOn && failOn(name, keys)) throw new Error('duplicate key')
            created.push(name + JSON.stringify(keys))
          },
        }
      },
    }
  }
  const settle = () => new Promise(r => setTimeout(r, 20))

  it('cria todos mesmo que a coleção antiga não exista', async () => {
    const { ensureIndexes, INDEXES } = await load()
    const d = db()
    ensureIndexes(d)
    await settle()
    expect(d.created).toHaveLength(INDEXES.length)
  })

  it('uma falha não impede os outros índices nem estoura erro', async () => {
    const { ensureIndexes, INDEXES } = await load()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const d = db((name) => name === 'users')
    ensureIndexes(d)
    await settle()
    expect(d.created.length).toBe(INDEXES.filter(([c]) => c !== 'users').length)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('roda uma vez só por instância', async () => {
    const { ensureIndexes, INDEXES } = await load()
    const d = db()
    ensureIndexes(d); ensureIndexes(d)
    await settle()
    expect(d.created).toHaveLength(INDEXES.length)
  })
})
