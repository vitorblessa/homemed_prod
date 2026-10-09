// Expiry status of a medicine. Pure functions so they can be tested.
//
// "Today" is the calendar day in Brazil (America/Sao_Paulo), not the server's
// (UTC on Vercel). Otherwise, after 21:00 in Brasília the server is already on
// the next day and a medicine that expires today would show as expired.

export const TIME_ZONE = 'America/Sao_Paulo';

export function todayBR(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: TIME_ZONE }); // YYYY-MM-DD
}

function dayNumber(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

// Whole days from today until the date (negative = already past), or null.
export function daysUntil(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr));
  let iso;
  if (m) {
    iso = m[0];
  } else {
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    iso = d.toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
  }
  return dayNumber(iso) - dayNumber(todayBR(now));
}

export function computeStatus(med, now = new Date()) {
  const d = daysUntil(med.data_validade, now);
  if (d == null) return { expiry_status: 'unknown', days_until_expiry: null };
  if (d < 0) return { expiry_status: 'expired', days_until_expiry: d };
  if (d <= 7) return { expiry_status: 'critical', days_until_expiry: d };
  if (d <= 30) return { expiry_status: 'warning_30', days_until_expiry: d };
  if (d <= 60) return { expiry_status: 'warning_60', days_until_expiry: d };
  if (d <= 90) return { expiry_status: 'warning_90', days_until_expiry: d };
  return { expiry_status: 'ok', days_until_expiry: d };
}
