import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { tooManyMessage } from '@/lib/rate-limit';
import { findSession, findUserByEmail } from '@/lib/data/users';

export const COOKIE_NAME = 'homemed_session';

export const OAUTH_STATE_COOKIE = 'homemed_oauth_state';

export const MIN = 60 * 1000;

export const HOUR = 60 * MIN;

export function tooMany(retryAfterSec) {
  const res = json({ error: tooManyMessage(retryAfterSec) }, 429);
  res.headers.set('Retry-After', String(retryAfterSec));
  return res;
}

export function json(data, status = 200, extra = {}) {
  const res = NextResponse.json(data, { status });
  if (extra.setCookie) {
    res.cookies.set(COOKIE_NAME, extra.setCookie, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  if (extra.clearCookie) {
    res.cookies.set(COOKIE_NAME, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 0,
    });
  }
  return res;
}

export async function currentUser(request) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const db = await getDb();
  const session = await findSession(db, token);
  if (!session) return null;
  if (session.expires_at && new Date(session.expires_at) < new Date()) return null;
  const userDoc = await findUserByEmail(db, session.email);
  return {
    email: session.email,
    name: session.name,
    picture: session.picture,
    family_id: userDoc?.family_id || null,
  };
}
