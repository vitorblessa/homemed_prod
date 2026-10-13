import { reportError } from '@/lib/monitoring';
import { json, currentUser } from '@/lib/api/common';
import { handleAuth } from '@/lib/api/auth';
import { handleFamilies } from '@/lib/api/families';
import { handleSettings } from '@/lib/api/settings';
import { handleAI } from '@/lib/api/ai';
import { handleMedicines } from '@/lib/api/medicines';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Ponto de entrada único da API: descobre a rota e entrega ao módulo certo
// (lib/api/*). Cada módulo devolve null quando a rota não é dele.
async function handle(request, ctx) {
  const params = await ctx.params;
  const segs = params?.path || [];
  const path = '/' + segs.join('/');
  const method = request.method;

  try {
    const route = { path, segs, method };

    // Públicas: autenticação, versão e raiz
    const authRes = await handleAuth(request, route);
    if (authRes) return authRes;

    // Which build is serving (public, no data): lets an open app detect a newer deploy
    if (path === '/version' && method === 'GET') {
      const res = json({ build: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' });
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }

    // Root (public)
    if (path === '/' || path === '') {
      return json({ ok: true, name: 'HomeMed API' });
    }

    // ============ AUTH REQUIRED FROM HERE ============
    const user = await currentUser(request);
    if (!user) return json({ error: 'Não autenticado' }, 401);
    const ctxUser = { ...route, user, userEmail: user.email };

    for (const run of [handleFamilies, handleSettings, handleAI, handleMedicines]) {
      const res = await run(request, ctxUser);
      if (res) return res;
    }

    return json({ error: 'rota não encontrada', path, method }, 404);
  } catch (e) {
    if (e?.name === 'AIUnavailableError') {
      // Temporary failure on Google's side: short message for the user, short detail for monitoring.
      console.error('AI unavailable', e.status, e.detail);
      await reportError(new Error(`AI unavailable (${e.status}): ${e.detail}`), { route: path, method });
      return json({ error: e.message }, 503);
    }
    console.error('API error', e);
    await reportError(e, { route: path, method });
    return json({ error: e.message || 'erro interno' }, 500);
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
