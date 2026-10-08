// Server-side error reporting (Sentry). Does nothing unless SENTRY_DSN is set.
//
// Privacy: HomeMed handles health-related data, so nothing about the request
// or the person is sent. Only the error, its stack trace and the route name
// (which is just the URL path, never query strings, bodies, headers or
// cookies). E-mail addresses that end up inside error messages are masked.

import * as Sentry from '@sentry/node';

let ready = false;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const mask = (s) => (typeof s === 'string' ? s.replace(EMAIL, '[email]') : s);

export function scrub(event) {
  delete event.request;
  delete event.user;
  delete event.server_name;
  event.breadcrumbs = [];
  if (event.message) event.message = mask(event.message);
  for (const ex of event.exception?.values || []) ex.value = mask(ex.value);
  return event;
}

function init() {
  if (ready) return true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 0,
    beforeSend: scrub,
  });
  ready = true;
  return true;
}

/** Reports an unexpected server error. Never throws. */
export async function reportError(error, { route, method, step } = {}) {
  try {
    if (!init()) return;
    Sentry.withScope((scope) => {
      if (route) scope.setTag('route', route);
      if (method) scope.setTag('method', method);
      if (step) scope.setTag('step', step);
      Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
    });
    // Serverless functions freeze right after responding; send now.
    await Sentry.flush(2000);
  } catch { /* monitoring must never break a request */ }
}
