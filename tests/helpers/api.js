import { NextRequest } from 'next/server'

// Chama a rota da API como o Next faria, sem subir servidor.
export async function call(handler, method, path, { body, cookie, ip = '10.0.0.1' } = {}) {
  const headers = { 'x-real-ip': ip }
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (cookie) headers.cookie = `homemed_session=${cookie}`
  const req = new NextRequest('http://localhost/api' + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const segs = path.split('?')[0].split('/').filter(Boolean)
  const res = await handler(req, { params: Promise.resolve({ path: segs }) })
  const data = await res.json().catch(() => null)
  const setCookie = res.cookies.get('homemed_session')
  return { status: res.status, data, cookie: setCookie?.value || null, headers: res.headers }
}
