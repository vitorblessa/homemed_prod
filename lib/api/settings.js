import { getDb } from '@/lib/mongo';
import { normalizeNotificationPrefs } from '@/lib/notification-prefs';
import { USERS, json } from '@/lib/api/common';

// Preferências por usuário (lembretes, tour, tema).
export async function handleSettings(request, { path, segs, method, user, userEmail }) {
  // Per-user app preferences (currently: expiry-notification settings).
  // Stored on the user document so they follow the account across devices;
  // each device schedules its own local notifications from them.
  if (path === '/settings' && method === 'GET') {
    const db = await getDb();
    const doc = await db.collection(USERS).findOne({ email: userEmail });
    return json({
      notifications: normalizeNotificationPrefs(doc?.settings?.notifications),
      tour_completed: doc?.settings?.tour_completed === true,
      theme: ['light', 'dark'].includes(doc?.settings?.theme) ? doc.settings.theme : null,
    });
  }

  // Accepts any subset of: { notifications: {...}, tour_completed: boolean, theme: 'light' | 'dark' }
  if (path === '/settings' && method === 'PUT') {
    const body = await request.json().catch(() => ({}));
    const hasNotif = body && typeof body.notifications === 'object' && body.notifications !== null;
    const hasTour = body && typeof body.tour_completed === 'boolean';
    const hasTheme = body && ['light', 'dark'].includes(body.theme);
    if (!hasNotif && !hasTour && !hasTheme) {
      return json({ error: 'Configurações inválidas' }, 400);
    }
    const set = { updated_at: new Date() };
    const out = {};
    if (hasNotif) {
      out.notifications = normalizeNotificationPrefs(body.notifications);
      set['settings.notifications'] = out.notifications;
    }
    if (hasTour) {
      out.tour_completed = body.tour_completed;
      set['settings.tour_completed'] = body.tour_completed;
    }
    if (hasTheme) {
      out.theme = body.theme;
      set['settings.theme'] = body.theme;
    }
    const db = await getDb();
    await db.collection(USERS).updateOne({ email: userEmail }, { $set: set });
    return json(out);
  }
  return null;
}
