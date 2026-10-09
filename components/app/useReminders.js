import { useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { normalizeNotificationPrefs } from '@/lib/notification-prefs'
import { buildNotificationPlan, describeNextReminder, isNativeApp, onNotificationTap, requestNotificationPermission, sendTestNotification, showWebReminders, syncNativeReminders } from '@/lib/notifications'

export function useReminders({ medicines, notifPermission, notifPrefs, notifPrefsRef, prefsLoaded, saveTimer, setDosesOpen, setFilterCat, setNextReminder, setNotifPermission, setNotifPrefs, setSearch, setSettingsOpen, setStatusFilter, tourDone, tourOpen, user }) {
  const updateNotifPrefs = useCallback((patch) => {
    const next = normalizeNotificationPrefs({ ...notifPrefsRef.current, ...patch })
    notifPrefsRef.current = next
    setNotifPrefs(next)
    if (user) {
      try { localStorage.setItem(`homemed_notif_prefs_${user.email}`, JSON.stringify(next)) } catch { /* ignore */ }
    }
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch('/api/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications: next }),
      }).then(r => { if (!r.ok) throw new Error() })
        .catch(() => toast.error('Não consegui salvar as configurações. Tente de novo.'))
    }, 600)
  }, [user])

  const askNotificationPermission = useCallback(async () => {
    const p = await requestNotificationPermission()
    setNotifPermission(p)
    if (p === 'granted') toast.success('Notificações ativadas!')
    else if (p === 'denied') toast.error('As notificações continuam bloqueadas.')
  }, [])

  const testNotification = useCallback(async () => {
    try {
      await sendTestNotification()
      toast.success('Enviada! Ela chega em instantes.')
    } catch {
      toast.error('Não foi possível enviar o teste.')
    }
  }, [])

  // Keep the reminders in step with the medicines, settings and permission.
  // Uses the FULL medicine list (the list on screen may be filtered).
  useEffect(() => {
    if (!user || !prefsLoaded) return
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/medicines', { credentials: 'include' })
        if (!res.ok) return
        const all = (await res.json()).medicines || []
        if (cancelled) return
        let plan
        if (isNativeApp()) {
          plan = await syncNativeReminders(all, notifPrefs)
        } else {
          plan = notifPrefs.enabled ? buildNotificationPlan(all, notifPrefs) : []
          await showWebReminders(all, notifPrefs, user.email)
        }
        if (!cancelled) setNextReminder(describeNextReminder(plan))
      } catch (e) {
        console.warn('Reminder sync failed', e)
      }
    }, 800)
    return () => { cancelled = true; clearTimeout(t) }
  }, [user, prefsLoaded, medicines, notifPrefs, notifPermission])

  // Tapping a reminder opens the list filtered to what is about to expire.
  useEffect(() => {
    if (!user) return
    return onNotificationTap((extra) => {
      if (extra?.type === 'expiry') {
        setSearch('')
        setFilterCat('all')
        setStatusFilter('expiring')
      } else if (extra?.type === 'dose') {
        setDosesOpen(true)
      } else if (extra?.type === 'low_stock') {
        setSearch('')
        setFilterCat('all')
        setStatusFilter('low_stock')
      }
    })
  }, [user])

  // One friendly nudge (once) to turn the reminders on.
  useEffect(() => {
    // Wait for the guided tour (new accounts) so the toast doesn't cover it.
    if (!user || !prefsLoaded || tourDone !== true || tourOpen || !notifPrefs.enabled || notifPermission !== 'prompt') return
    const key = `homemed_notif_nudged_${user.email}`
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1') } catch { return }
    toast('Quer ser avisado quando um remédio estiver para vencer?', {
      duration: 12000,
      action: { label: 'Configurar', onClick: () => setSettingsOpen(true) },
    })
  }, [user, prefsLoaded, tourDone, tourOpen, notifPrefs.enabled, notifPermission])

  return { updateNotifPrefs, askNotificationPermission, testNotification }
}
