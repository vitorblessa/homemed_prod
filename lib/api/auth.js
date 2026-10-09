import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { hit, clear, clientIp } from '@/lib/rate-limit';
import { reportError } from '@/lib/monitoring';
import { COOKIE_NAME, OAUTH_STATE_COOKIE, MIN, HOUR, tooMany, json, currentUser } from '@/lib/api/common';
import {
  consumeResetToken, createSession, deactivateUser, deleteSession, deleteSessionsOf, deleteUser,
  findUserByEmail, reactivateUser, saveResetRequest, savePasswordUser, upsertGoogleUser,
} from '@/lib/data/users';
import { deleteFamily, findFamilyById, removeFamilyMember } from '@/lib/data/families';
import { deleteHistoryOf, deleteMedicinesOf, releaseFamilyMedicines } from '@/lib/data/medicines';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Password reset
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // link valid for 1 hour

const RESET_THROTTLE_MS = 60 * 1000; // at most one email per account per minute

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Sends the reset link through Resend (https://resend.com). Needs
// RESEND_API_KEY (and a verified sender domain for EMAIL_FROM). Without the
// key it just logs, so the rest of the app keeps working while email is
// being set up. Never throws: the caller must answer the same way whether
// or not the email actually went out.
async function sendPasswordResetEmail(to, name, link) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[password-reset] RESEND_API_KEY not set; email not sent');
    return false;
  }
  const from = process.env.EMAIL_FROM || 'HomeMed AI <nao-responda@homemed.tech>';
  const senderEmail = escapeHtml((from.match(/<([^>]+)>/) || [])[1] || from);
  const greeting = name ? `Olá, ${escapeHtml(name)}!` : 'Olá!';
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 16px">HomeMed AI</h2>
      <p>${greeting}</p>
      <p>Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha. O link vale por 1 hora.</p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">Redefinir minha senha</a>
      </p>
      <p style="font-size:13px;color:#475569">Se o botão não funcionar, copie e cole este endereço no navegador:<br><span style="word-break:break-all">${link}</span></p>
      <p style="font-size:13px;color:#475569">Se você não pediu isso, pode ignorar este e-mail: sua senha continua a mesma.</p>
      <p style="font-size:13px;color:#475569;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:20px"><strong>Dica:</strong> adicione <strong>${senderEmail}</strong> aos seus contatos. Assim os próximos e-mails do HomeMed AI chegam na caixa de entrada, e não no lixo eletrônico.</p>
    </div>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        // Replies to the automated email land in the support inbox.
        reply_to: process.env.EMAIL_REPLY_TO || 'suporte@homemed.tech',
        subject: 'Redefinir sua senha do HomeMed AI',
        html,
        text: `Para redefinir sua senha do HomeMed AI, abra este link (válido por 1 hora): ${link}\n\nSe você não pediu isso, ignore este e-mail.\n\nDica: adicione ${(from.match(/<([^>]+)>/) || [])[1] || from} aos seus contatos para os próximos e-mails do HomeMed AI chegarem na caixa de entrada, e não no lixo eletrônico.`,
      }),
    });
    if (!res.ok) {
      console.error('[password-reset] Resend error', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (e) {
    console.error('[password-reset] send failed', e);
    return false;
  }
}

// Registro, login, senha, Google e conta. Devolve null se a rota não for de autenticação.
export async function handleAuth(request, { path, segs, method }) {
  if (path === '/auth/register' && method === 'POST') {
    const body = await request.json();
    const email = (body?.email || '').toString().trim().toLowerCase();
    const password = (body?.password || '').toString();
    const name = (body?.name || '').toString().trim() || email.split('@')[0];
    if (!email || !email.includes('@')) return json({ error: 'Email inválido' }, 400);
    if (password.length < 6) return json({ error: 'Senha deve ter no mínimo 6 caracteres' }, 400);
    const db = await getDb();
    const rl = await hit(db, `register:ip:${clientIp(request)}`, 10, HOUR);
    if (!rl.allowed) return tooMany(rl.retryAfterSec);
    const existing = await findUserByEmail(db, email);
    if (existing && existing.password_hash) {
      return json({ error: 'Este email já está registrado. Faça login.' }, 409);
    }
    const password_hash = await bcrypt.hash(password, 10);
    const now = new Date();
    await savePasswordUser(db, { email, name, password_hash, existing, now });
    const token = await createSession(db, { email, name, now });
    return json({ email, name, picture: '' }, 200, { setCookie: token });
  }

  if (path === '/auth/login' && method === 'POST') {
    const body = await request.json();
    const email = (body?.email || '').toString().trim().toLowerCase();
    const password = (body?.password || '').toString();
    if (!email || !password) return json({ error: 'Email e senha obrigatórios' }, 400);
    const db = await getDb();
    // 8 attempts per account and 30 per IP, every 15 minutes (a correct
    // login clears the account counter).
    const accountKey = `login:email:${email}`;
    const rlIp = await hit(db, `login:ip:${clientIp(request)}`, 30, 15 * MIN);
    if (!rlIp.allowed) return tooMany(rlIp.retryAfterSec);
    const rlAcc = await hit(db, accountKey, 8, 15 * MIN);
    if (!rlAcc.allowed) return tooMany(rlAcc.retryAfterSec);
    const user = await findUserByEmail(db, email);
    if (!user || !user.password_hash) {
      return json({ error: 'Email ou senha inválidos' }, 401);
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return json({ error: 'Email ou senha inválidos' }, 401);
    await clear(db, accountKey, 15 * MIN);
    // Reactivate on login
    if (user.deactivated) await reactivateUser(db, user.email);
    const token = await createSession(db, {
      email: user.email,
      name: user.name || email.split('@')[0],
      picture: user.picture || '',
    });
    return json({ email: user.email, name: user.name, picture: user.picture || '' }, 200, { setCookie: token });
  }

  // Step 1 of "forgot password": email a one-hour, single-use link. Always
  // answers the same way so it can't be used to discover which emails have
  // an account. Only a SHA-256 hash of the token is stored.
  if (path === '/auth/forgot-password' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const email = (body?.email || '').toString().trim().toLowerCase();
    const generic = { ok: true, message: 'Se existir uma conta com este e-mail, enviamos um link para redefinir a senha.' };
    if (!email || !email.includes('@')) return json({ error: 'Informe um e-mail válido' }, 400);
    const db = await getDb();
    // 5 requests per IP per hour; per account only 3 per hour, answered with
    // the generic message so it can't reveal whether the account exists.
    const rlIp = await hit(db, `forgot:ip:${clientIp(request)}`, 5, HOUR);
    if (!rlIp.allowed) return tooMany(rlIp.retryAfterSec);
    const rlAcc = await hit(db, `forgot:email:${email}`, 3, HOUR);
    if (!rlAcc.allowed) return json(generic);
    const user = await findUserByEmail(db, email);
    if (!user) return json(generic);
    const last = user.reset_requested_at ? new Date(user.reset_requested_at).getTime() : 0;
    if (Date.now() - last < RESET_THROTTLE_MS) return json(generic);
    const token = crypto.randomBytes(32).toString('hex');
    await saveResetRequest(db, email, {
      hash: hashResetToken(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });
    const baseUrl = (process.env.APP_URL || 'https://www.homemed.tech').replace(/\/+$/, '');
    await sendPasswordResetEmail(email, user.name, `${baseUrl}/?reset=${token}`);
    return json(generic);
  }

  // Step 2: trade a valid token for a new password. The token is consumed
  // atomically (single use) and every existing session of the account is
  // revoked, in case someone else had access.
  if (path === '/auth/reset-password' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const token = (body?.token || '').toString().trim();
    const password = (body?.password || '').toString();
    if (!token) return json({ error: 'Link inválido ou expirado' }, 400);
    if (password.length < 6) return json({ error: 'Senha deve ter no mínimo 6 caracteres' }, 400);
    const db = await getDb();
    const rl = await hit(db, `reset:ip:${clientIp(request)}`, 10, HOUR);
    if (!rl.allowed) return tooMany(rl.retryAfterSec);
    const password_hash = await bcrypt.hash(password, 10);
    const user = await consumeResetToken(db, hashResetToken(token), { password_hash });
    if (!user) return json({ error: 'Link inválido ou expirado. Peça um novo.' }, 400);
    await deleteSessionsOf(db, user.email);
    return json({ ok: true });
  }

  if (path === '/auth/google' && method === 'GET') {
    if (!GOOGLE_CLIENT_ID) {
      return json({ error: 'Login com Google não configurado (defina GOOGLE_CLIENT_ID)' }, 500);
    }
    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/auth/google/callback`;
    const state = uuidv4();

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'online');
    authUrl.searchParams.set('prompt', 'select_account');

    const res = NextResponse.redirect(authUrl.toString());
    res.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes is plenty to complete the Google consent screen
    });
    return res;
  }

  if (path === '/auth/google/callback' && method === 'GET') {
    const url = new URL(request.url);
    const origin = url.origin;
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const googleError = url.searchParams.get('error');
    const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

    const failRedirect = (message) => {
      const r = NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(message)}`);
      r.cookies.set(OAUTH_STATE_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
      return r;
    };

    if (googleError) return failRedirect('Login com Google cancelado');
    if (!code || !state || !expectedState || state !== expectedState) {
      return failRedirect('Falha na verificação do login com Google. Tente novamente.');
    }
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return failRedirect('Login com Google não configurado no servidor');
    }

    let tokenData;
    try {
      const redirectUri = `${origin}/api/auth/google/callback`;
      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
        cache: 'no-store',
      });
      if (!tokenResp.ok) {
        console.error('Google token exchange failed', tokenResp.status, await tokenResp.text());
        return failRedirect('Falha ao autenticar com o Google (token)');
      }
      tokenData = await tokenResp.json();
    } catch (e) {
      console.error('Google token exchange threw', e);
      return failRedirect('Erro ao trocar o código com o Google');
    }

    if (!tokenData?.access_token) {
      console.error('Google token response missing access_token', tokenData);
      return failRedirect('Google não retornou um token de acesso válido');
    }

    let profile;
    try {
      const userResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        cache: 'no-store',
      });
      if (!userResp.ok) {
        console.error('Google userinfo fetch failed', userResp.status, await userResp.text());
        return failRedirect('Falha ao obter perfil do Google');
      }
      profile = await userResp.json();
    } catch (e) {
      console.error('Google userinfo fetch threw', e);
      return failRedirect('Erro ao buscar seu perfil do Google');
    }

    if (!profile?.email || typeof profile.email !== 'string') {
      console.error('Google profile missing email', profile);
      return failRedirect('Sua conta Google não retornou um email');
    }
    if (profile.email_verified === false) return failRedirect('Email do Google não verificado');

    const email = profile.email.toLowerCase();
    const name = profile.name || email.split('@')[0];
    const picture = profile.picture || '';

    let step = 'getDb';
    try {
      const db = await getDb();
      step = 'updateOne';
      const now = new Date();
      await upsertGoogleUser(db, { email, name, picture, now });
      step = 'insertOne';
      const token = await createSession(db, { email, name, picture, now });

      step = 'redirect';
      const res = NextResponse.redirect(`${origin}/?welcome=1`);
      step = 'set-cookie';
      res.cookies.set(COOKIE_NAME, token, {
        httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 60 * 60 * 24 * 7,
      });
      res.cookies.set(OAUTH_STATE_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
      return res;
    } catch (e) {
      console.error(`Google OAuth session/db step threw at step=${step}`, {
        name: e?.name, message: e?.message, stack: e?.stack, raw: String(e),
      });
      await reportError(e, { route: path, method, step });
      return failRedirect(`Erro ao salvar sua sessão (${step})`);
    }
  }

  // Native Google Sign-In (Android app). The web redirect flow above
  // (/auth/google + /auth/google/callback) doesn't work inside the app's
  // embedded WebView — Google blocks OAuth there and forces an external
  // browser, whose session cookie never reaches the app. So the Android
  // app uses Android's Credential Manager instead (via the
  // @capgo/capacitor-social-login plugin) and sends the resulting ID
  // token here. The plugin is initialized with webClientId =
  // GOOGLE_CLIENT_ID (the same Web OAuth client used by the browser flow),
  // so the token's audience matches what we already verify against below —
  // this route doesn't need a separate client ID or any new env var.
  if (path === '/auth/google/token' && method === 'POST') {
    if (!GOOGLE_CLIENT_ID) {
      return json({ error: 'Login com Google não configurado (defina GOOGLE_CLIENT_ID)' }, 500);
    }
    const body = await request.json();
    const idToken = body?.id_token;
    if (!idToken || typeof idToken !== 'string') {
      return json({ error: 'id_token obrigatório' }, 400);
    }
    {
      const rl = await hit(await getDb(), `gtoken:ip:${clientIp(request)}`, 30, 15 * MIN);
      if (!rl.allowed) return tooMany(rl.retryAfterSec);
    }

    let payload;
    try {
      const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
        cache: 'no-store',
      });
      if (!resp.ok) {
        console.error('Google tokeninfo rejected token', resp.status, await resp.text());
        return json({ error: 'Token do Google inválido' }, 401);
      }
      payload = await resp.json();
    } catch (e) {
      console.error('Google tokeninfo fetch threw', e);
      return json({ error: 'Erro ao validar token do Google' }, 502);
    }

    if (payload.aud !== GOOGLE_CLIENT_ID) {
      console.error('Google id_token audience mismatch', { aud: payload.aud });
      return json({ error: 'Token não pertence a este app' }, 401);
    }
    if (payload.email_verified === 'false' || payload.email_verified === false) {
      return json({ error: 'Email do Google não verificado' }, 401);
    }
    if (!payload.email || typeof payload.email !== 'string') {
      return json({ error: 'Google não retornou um email' }, 401);
    }

    const email = payload.email.toLowerCase();
    const name = payload.name || email.split('@')[0];
    const picture = payload.picture || '';

    let step = 'getDb';
    try {
      const db = await getDb();
      step = 'updateOne';
      const now = new Date();
      await upsertGoogleUser(db, { email, name, picture, now });
      step = 'insertOne';
      const token = await createSession(db, { email, name, picture, now });
      return json({ email, name, picture }, 200, { setCookie: token });
    } catch (e) {
      console.error(`Google native login session/db step threw at step=${step}`, {
        name: e?.name, message: e?.message, stack: e?.stack, raw: String(e),
      });
      await reportError(e, { route: path, method, step });
      return json({ error: `Erro ao salvar sua sessão (${step})` }, 500);
    }
  }

  if (path === '/auth/me' && method === 'GET') {
    const user = await currentUser(request);
    if (!user) return json({ user: null }, 200);
    return json({ user });
  }

  if (path === '/auth/logout' && method === 'POST') {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (token) {
      const db = await getDb();
      await deleteSession(db, token);
    }
    return json({ ok: true }, 200, { clearCookie: true });
  }

  if (path === '/auth/deactivate' && method === 'POST') {
    const u = await currentUser(request);
    if (!u) return json({ error: 'Não autenticado' }, 401);
    const db = await getDb();
    await deactivateUser(db, u.email);
    await deleteSessionsOf(db, u.email);
    return json({ ok: true, message: 'Conta desativada. Faça login novamente para reativar.' }, 200, { clearCookie: true });
  }

  if (path === '/auth/account' && method === 'DELETE') {
    const u = await currentUser(request);
    if (!u) return json({ error: 'Não autenticado' }, 401);
    const body = await request.json().catch(() => ({}));
    const confirmEmail = (body?.confirm_email || '').toString().trim().toLowerCase();
    if (confirmEmail !== u.email.toLowerCase()) {
      return json({ error: 'Confirmação incorreta. Digite exatamente seu email.' }, 400);
    }
    const db = await getDb();
    if (u.family_id) {
      const fam = await findFamilyById(db, u.family_id);
      if (fam) {
        const others = (fam.member_emails || []).filter(e => e !== u.email);
        if (others.length === 0) {
          await deleteFamily(db, fam.id);
          await releaseFamilyMedicines(db, fam.id);
        } else {
          let newOwner = fam.owner_email;
          if (fam.owner_email === u.email) newOwner = others[0];
          await removeFamilyMember(db, fam.id, u.email, newOwner);
        }
      }
    }
    await deleteMedicinesOf(db, u.email);
    await deleteHistoryOf(db, u.email);
    await deleteSessionsOf(db, u.email);
    await deleteUser(db, u.email);
    return json({ ok: true, message: 'Conta excluída permanentemente.' }, 200, { clearCookie: true });
  }
  return null;
}
