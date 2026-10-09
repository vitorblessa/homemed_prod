// Banco falso em memória, com o mínimo do driver do MongoDB que as rotas usam:
// findOne, insertOne, updateOne/updateMany, findOneAndUpdate, deleteOne/deleteMany,
// countDocuments, createIndex. Filtros: igualdade, $gt, $exists, $or, $in.
// findOneAndUpdate devolve o documento direto (formato do driver 6).

function get(doc, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), doc)
}

function matchValue(actual, cond) {
  if (cond && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
    return Object.entries(cond).every(([op, v]) => {
      if (op === '$gt') return actual != null && new Date(actual) > new Date(v)
      if (op === '$gte') return actual != null && new Date(actual) >= new Date(v)
      if (op === '$lt') return actual != null && new Date(actual) < new Date(v)
      if (op === '$exists') return (actual !== undefined) === v
      if (op === '$in') return v.includes(actual)
      if (op === '$ne') return actual !== v
      throw new Error('operador não suportado no banco falso: ' + op)
    })
  }
  if (cond instanceof Date) return actual instanceof Date && actual.getTime() === cond.getTime()
  if (cond === null) return actual == null
  return actual === cond
}

export function matches(doc, filter = {}) {
  return Object.entries(filter).every(([k, v]) => {
    if (k === '$or') return v.some(f => matches(doc, f))
    return matchValue(get(doc, k), v)
  })
}

function applyUpdate(doc, update, inserting) {
  for (const [k, v] of Object.entries(update.$set || {})) doc[k] = v
  if (inserting) for (const [k, v] of Object.entries(update.$setOnInsert || {})) doc[k] = v
  for (const k of Object.keys(update.$unset || {})) delete doc[k]
  for (const [k, v] of Object.entries(update.$inc || {})) doc[k] = (doc[k] || 0) + v
  for (const [k, v] of Object.entries(update.$pull || {})) doc[k] = (doc[k] || []).filter(x => x !== v)
  for (const [k, v] of Object.entries(update.$addToSet || {})) { doc[k] = doc[k] || []; if (!doc[k].includes(v)) doc[k].push(v) }
}

function seedFromFilter(filter) {
  const seed = {}
  for (const [k, v] of Object.entries(filter)) {
    if (!k.startsWith('$') && (v === null || typeof v !== 'object' || v instanceof Date)) seed[k] = v
  }
  return seed
}

export function createFakeDb() {
  const store = new Map()
  const rows = name => { if (!store.has(name)) store.set(name, []); return store.get(name) }

  function collection(name) {
    const docs = rows(name)
    return {
      createIndex: async () => 'ok',
      findOne: async (filter) => { const d = docs.find(x => matches(x, filter)); return d ? structuredClone(d) : null },
      find: (filter) => {
        let list = docs.filter(d => matches(d, filter)).map(d => structuredClone(d))
        const cur = {
          sort: (spec) => {
            const [[k, dir]] = Object.entries(spec)
            list = [...list].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * dir)
            return cur
          },
          toArray: async () => list,
        }
        return cur
      },
      countDocuments: async (filter) => docs.filter(d => matches(d, filter)).length,
      insertOne: async (doc) => { docs.push({ ...doc }); return { acknowledged: true } },
      updateOne: async (filter, update, opts = {}) => {
        let d = docs.find(x => matches(x, filter))
        if (!d && opts.upsert) { d = seedFromFilter(filter); docs.push(d); applyUpdate(d, update, true); return { upsertedCount: 1 } }
        if (!d) return { matchedCount: 0 }
        applyUpdate(d, update, false)
        return { matchedCount: 1 }
      },
      updateMany: async (filter, update) => {
        const hit = docs.filter(x => matches(x, filter))
        hit.forEach(d => applyUpdate(d, update, false))
        return { matchedCount: hit.length }
      },
      findOneAndUpdate: async (filter, update, opts = {}) => {
        let d = docs.find(x => matches(x, filter))
        let inserting = false
        if (!d && opts.upsert) { d = seedFromFilter(filter); if (filter._id !== undefined) d._id = filter._id; docs.push(d); inserting = true }
        if (!d) return null
        const before = { ...d }
        applyUpdate(d, update, inserting)
        return structuredClone(opts.returnDocument === 'after' ? d : before)
      },
      deleteOne: async (filter) => {
        const i = docs.findIndex(x => matches(x, filter))
        if (i >= 0) docs.splice(i, 1)
        return { deletedCount: i >= 0 ? 1 : 0 }
      },
      deleteMany: async (filter) => {
        let n = 0
        for (let i = docs.length - 1; i >= 0; i--) if (matches(docs[i], filter)) { docs.splice(i, 1); n++ }
        return { deletedCount: n }
      },
    }
  }
  return { collection, rows }
}
