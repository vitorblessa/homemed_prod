'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTheme } from 'next-themes'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { SocialLogin } from '@capgo/capacitor-social-login'
import { SafeArea } from '@capacitor-community/safe-area'
import { useAndroidBack } from '@/lib/useAndroidBack'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { toast, Toaster } from 'sonner'
import { Pill, Search, Plus, Sparkles, CalendarClock, Package, Boxes, MapPin, Moon, Sun, Loader2, MessageCircle, X, ShieldAlert, Info, TrendingDown, Archive, Download, FileText, FileSpreadsheet, File, LogOut, Users, Settings } from 'lucide-react'
import { DOSE_REMINDERS_ENABLED, normalizeDoseTimes } from '@/lib/doses'
import SettingsSheet from '@/components/SettingsSheet'
import GuidedTour from '@/components/GuidedTour'
import { DEFAULT_NOTIFICATION_PREFS, normalizeNotificationPrefs } from '@/lib/notification-prefs'
import { appNeedsUpdate, buildNotificationPlan, describeNextReminder, getNotificationPermission, isNativeApp, onNotificationTap, requestNotificationPermission, sendTestNotification, showWebReminders, syncNativeReminders } from '@/lib/notifications'
import { exportToPDF, exportToExcel, exportToCSV } from '@/lib/export'
import { CategoryBadge, StatCard, CategoryScroller } from '@/components/app/ui-bits'
import { MedicineCard } from '@/components/app/MedicineCard'
import { LandingScreen } from '@/components/app/LandingScreen'
import { LoginScreen } from '@/components/app/LoginScreen'
import { DosesSheet } from '@/components/app/DosesSheet'
import { TravelListDialog } from '@/components/app/TravelListDialog'
import { AddMedicineDialog } from '@/components/app/AddMedicineDialog'
import { MedicineDetailSheet } from '@/components/app/MedicineDetailSheet'
import { FamilyDialog } from '@/components/app/FamilyDialog'
import { AccountDialog } from '@/components/app/AccountDialog'
import { AIAssistantSheet } from '@/components/app/AIAssistantSheet'

// Web OAuth Client ID (not a secret — it's a public identifier). Same
// GOOGLE_CLIENT_ID our backend already verifies ID tokens against (see
// app/api/[[...path]]/route.js, /auth/google/token). Used as the plugin's
// webClientId: on Android, Credential Manager/Google Play Services issues
// an ID token for THIS client even though sign-in itself is gated by a
// separate "Android" OAuth client (package name + signing-cert SHA-1)
// registered in Google Cloud Console, which has to match whichever
// certificate actually signed the running build (the Play App Signing
// cert for anything installed from the Play Store/testing tracks, not the
// local upload-key cert).
const GOOGLE_WEB_CLIENT_ID = '225884335654-q7j0bih6j8sa02bnm4jdmi3cdid4qo91.apps.googleusercontent.com'

function App() {
  const { theme, setTheme } = useTheme()
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, expired: 0, expiring: 0, low_stock: 0, categories: {}, last_added: [] })
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [filterLocal, setFilterLocal] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'expiring' | 'expired' | 'low_stock'
  const [addOpen, setAddOpen] = useState(false)
  const [editMed, setEditMed] = useState(null)
  const [detailMed, setDetailMed] = useState(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [familyOpen, setFamilyOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dosesOpen, setDosesOpen] = useState(false)
  const [travelOpen, setTravelOpen] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState(DEFAULT_NOTIFICATION_PREFS)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [notifPermission, setNotifPermission] = useState('prompt')
  const [nextReminder, setNextReminder] = useState(null)
  const saveTimer = useRef(null)
  const [tourOpen, setTourOpen] = useState(false)
  const [tourDone, setTourDone] = useState(null) // null = not known yet
  const lastSigRef = useRef('')
  const [lastSync, setLastSync] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const notifPrefsRef = useRef(DEFAULT_NOTIFICATION_PREFS)
  // null = showing the public landing page; 'login' | 'register' = showing
  // the auth screen on that tab. Signed-out visitors land on the public
  // page first, never on a forced login wall.
  const [authMode, setAuthMode] = useState(null)
  // Token from the emailed "reset your password" link (/?reset=TOKEN).
  const [resetToken, setResetToken] = useState(null)

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('reset')
    if (t) setResetToken(t)
  }, [])

  // Android hardware back button: close whichever of these is open instead
  // of letting the WebView navigate back to the login screen. Order here
  // doesn't matter — the hook tracks whichever was opened most recently.
  useAndroidBack(accountOpen, () => setAccountOpen(false))
  useAndroidBack(settingsOpen, () => setSettingsOpen(false))
  useAndroidBack(dosesOpen, () => setDosesOpen(false))
  useAndroidBack(travelOpen, () => setTravelOpen(false))
  useAndroidBack(tourOpen, () => finishTour())
  useAndroidBack(familyOpen, () => setFamilyOpen(false))
  useAndroidBack(aiOpen, () => setAiOpen(false))
  useAndroidBack(!!detailMed, () => setDetailMed(null))
  useAndroidBack(!!editMed, () => setEditMed(null))
  useAndroidBack(addOpen, () => setAddOpen(false))
  useAndroidBack(!!authMode, () => setAuthMode(null))

  // Loads medicines + stats. `silent` skips the loading spinner (background
  // refreshes). Only touches state when the data really changed, so a quiet
  // refresh doesn't redraw the list or reschedule reminders for nothing.
  // Resolves to true when the server answered.
  const loadAll = useCallback(async ({ silent = false } = {}) => {
    if (!user) return false
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterCat && filterCat !== 'all') params.set('categoria', filterCat)
      const [medRes, statRes] = await Promise.all([
        fetch('/api/medicines?' + params.toString(), { credentials: 'include' }),
        fetch('/api/stats', { credentials: 'include' }),
      ])
      if (!medRes.ok || !statRes.ok) throw new Error('bad status')
      const medData = await medRes.json()
      const statData = await statRes.json()
      const sig = JSON.stringify([medData.medicines || [], statData])
      if (sig !== lastSigRef.current) {
        lastSigRef.current = sig
        setMedicines(medData.medicines || [])
        setStats(statData)
      }
      setLastSync(Date.now())
      return true
    } catch (e) {
      if (!silent) toast.error('Erro ao carregar dados')
      return false
    } finally {
      if (!silent) setLoading(false)
    }
  }, [search, filterCat, user])

  // Manual "Sincronizar agora" (Settings).
  const syncNow = useCallback(async () => {
    setSyncing(true)
    const ok = await loadAll({ silent: true })
    setSyncing(false)
    if (ok) toast.success('Tudo sincronizado!')
    else toast.error('Não consegui sincronizar. Verifique a conexão.')
  }, [loadAll])

  // ============ AUTH ============
  useEffect(() => {
    // Native Google Sign-In only makes sense inside the Android app; the
    // config (serverClientId etc.) comes from capacitor.config.js.
    if (Capacitor.isNativePlatform()) {
      SocialLogin.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID } })

      // Paint the status bar to match the app's blue header, and the
      // navigation bar black so the system back/home/recents icons (which
      // are light-colored) stay visible instead of disappearing against a
      // white background. Called here (not just left to capacitor.config.js)
      // so it takes effect immediately on the live site, without needing a
      // new native build.
      SafeArea.enable({
        config: {
          customColorsForSystemBars: false,
          // Android's Color.parseColor expects alpha FIRST (#AARRGGBB), not
          // last — #2563EBFF was being read as ~14% opacity, so it looked
          // like nothing happened. FF prefix = fully opaque.
          statusBarColor: '#FF2563EB',
          statusBarContent: 'light',
          navigationBarColor: '#FF000000',
          navigationBarContent: 'light',
        },
      })
    }
  }, [])

  useEffect(() => {
    async function bootstrap() {
      try {
        const params = new URLSearchParams(window.location.search)
        const authError = params.get('auth_error')
        const welcome = params.get('welcome')
        if (authError || welcome) {
          window.history.replaceState({}, document.title, window.location.pathname)
        }

        const res = await fetch('/api/auth/me', { credentials: 'include' })
        const data = await res.json()
        setUser(data.user)

        if (data.user && welcome) {
          toast.success(`Bem-vindo, ${data.user.name || data.user.email}!`)
        } else if (authError) {
          toast.error(authError)
        }
      } catch {
        setUser(null)
      } finally {
        setAuthLoading(false)
      }
    }
    bootstrap()
  }, [])

  useEffect(() => { if (user) loadAll() }, [loadAll, user])

  // Forget the last-seen data when nobody is signed in. Without this, signing
  // out and back into the same account fetched an identical list, matched the
  // stale signature and skipped the update, leaving the screen empty until
  // the app was force-closed.
  useEffect(() => { if (!user) lastSigRef.current = null }, [user])

  // The app loads the live site, so an app left open keeps running the code it
  // started with. When the server reports a newer build, offer a reload.
  useEffect(() => {
    const mine = process.env.NEXT_PUBLIC_BUILD_ID
    if (!mine || mine === 'dev') return
    let shown = false
    const check = async () => {
      if (shown) return
      try {
        const r = await fetch('/api/version', { cache: 'no-store' })
        if (!r.ok) return
        const { build } = await r.json()
        if (build && build !== 'dev' && build !== mine) {
          shown = true
          toast('Nova versão disponível', {
            duration: Infinity,
            action: { label: 'Atualizar', onClick: () => window.location.reload() },
          })
        }
      } catch { /* offline: try again later */ }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    const t = setInterval(check, 10 * 60 * 1000)
    check()
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(t) }
  }, [])

  // Keep the list in step with changes made elsewhere (the website, another
  // family member): refresh when the app comes back to the foreground and
  // every minute while it is open. Quiet and throttled.
  const loadAllRef = useRef(loadAll)
  useEffect(() => { loadAllRef.current = loadAll }, [loadAll])
  useEffect(() => {
    if (!user) return
    let last = Date.now()
    const refresh = (minGap) => {
      if (document.visibilityState === 'hidden') return
      if (Date.now() - last < minGap) return
      last = Date.now()
      loadAllRef.current({ silent: true })
    }
    const onVisible = () => refresh(10000)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('online', onVisible)
    const timer = setInterval(() => refresh(55000), 60000)
    let appHandle = null
    let cancelled = false
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('appStateChange', (st) => { if (st.isActive) refresh(10000) })
        .then(h => { if (cancelled) h.remove(); else appHandle = h })
        .catch(() => {})
    }
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('online', onVisible)
      clearInterval(timer)
      appHandle?.remove()
    }
  }, [user])

  // ============ NOTIFICATIONS ============
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW register failed', err))
  }, [])

  // Preferences: show the cached copy instantly, then refresh from the server.
  useEffect(() => {
    if (!user) return
    const cacheKey = `homemed_notif_prefs_${user.email}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) { const p = normalizeNotificationPrefs(JSON.parse(cached)); notifPrefsRef.current = p; setNotifPrefs(p) }
    } catch { /* ignore */ }
    let cancelled = false
    fetch('/api/settings', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled || !d) return
        if (typeof d.tour_completed === 'boolean') setTourDone(d.tour_completed)
        // Theme follows the account across devices (the local copy only makes it instant).
        if (d.theme === 'light' || d.theme === 'dark') setTheme(d.theme)
        if (!d.notifications) return
        const p = normalizeNotificationPrefs(d.notifications)
        notifPrefsRef.current = p
        setNotifPrefs(p)
        try { localStorage.setItem(cacheKey, JSON.stringify(p)) } catch { /* ignore */ }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPrefsLoaded(true) })
    getNotificationPermission().then(setNotifPermission)
    return () => { cancelled = true }
  }, [user])

  // Re-check the permission whenever the sheet opens (the user may have
  // changed it in Android's system settings).
  useEffect(() => {
    if (settingsOpen) getNotificationPermission().then(setNotifPermission)
  }, [settingsOpen])

  // Guided tour: offered once to new accounts (no medicines yet), remembered
  // on the account so it doesn't repeat on another device. Can be replayed
  // from Settings.
  function finishTour() {
    setTourOpen(false)
    if (tourDone !== true) {
      setTourDone(true)
      fetch('/api/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tour_completed: true }),
      }).catch(() => {})
    }
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    fetch('/api/settings', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {})
  }

  const startTour = useCallback(() => {
    setSettingsOpen(false)
    setTimeout(() => setTourOpen(true), 400)
  }, [])

  useEffect(() => {
    if (!user || tourDone !== false || tourOpen || lastSync == null) return
    if (stats.total > 0 || settingsOpen || addOpen || aiOpen || familyOpen || accountOpen) return
    const t = setTimeout(() => setTourOpen(true), 900)
    return () => clearTimeout(t)
  }, [user, tourDone, tourOpen, lastSync, stats.total, settingsOpen, addOpen, aiOpen, familyOpen, accountOpen])

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

  const doLogin = async () => {
    // Inside the Android app, Google blocks OAuth in embedded WebViews and
    // kicks the flow out to an external browser, whose session cookie never
    // makes it back into the app. So the native app signs in with Android's
    // Credential Manager (via @capgo/capacitor-social-login) instead and
    // sends the ID token to our own backend (/auth/google/token), which
    // verifies it the same way as the web flow below.
    if (Capacitor.isNativePlatform()) {
      try {
        // Don't pass options.scopes: the plugin already requests
        // email/profile/openid by default, and setting scopes explicitly
        // makes it require wiring a custom MainActivity (only needed for
        // scopes beyond that default set, which we don't need).
        const { result } = await SocialLogin.login({
          provider: 'google',
          options: {},
        })
        const idToken = result?.idToken
        if (!idToken) throw new Error('Google não retornou um token de login')
        const res = await fetch('/api/auth/google/token', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: idToken }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Falha no login com Google')
        setUser(data)
        toast.success(`Bem-vindo, ${data.name || data.email}!`)
      } catch (e) {
        if (e?.message && !/cancel/i.test(e.message)) {
          toast.error(e.message || 'Login com Google falhou')
          console.error('Google native sign-in error', e)
        }
      }
      return
    }
    // Web: first-party OAuth redirect flow (see app/api/[[...path]]/route.js:
    // /auth/google and /auth/google/callback). Relative URL, so it works on
    // whatever domain the app is running on — no hardcoded host needed.
    window.location.href = '/api/auth/google'
  }

  const doLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
    setMedicines([])
    setStats({ total: 0, expired: 0, expiring: 0, low_stock: 0, categories: {}, last_added: [] })
    toast.success('Você saiu')
  }

  const filteredMedicines = medicines
    .filter(m => {
      if (statusFilter === 'expired') return m.expiry_status === 'expired'
      if (statusFilter === 'expiring') return ['critical', 'warning_30', 'warning_60', 'warning_90'].includes(m.expiry_status)
      if (statusFilter === 'low_stock') return m.quantidade != null && m.quantidade_minima != null && Number(m.quantidade) <= Number(m.quantidade_minima)
      return true
    })
    .filter(m => {
      if (filterLocal === 'all') return true
      if (filterLocal === '__none__') return !m.local || !m.local.trim()
      return (m.local || '').trim() === filterLocal
    })
    .sort((a, b) => {
      const catA = (a.categoria || 'Outros').toString()
      const catB = (b.categoria || 'Outros').toString()
      const c = catA.localeCompare(catB, 'pt-BR', { sensitivity: 'base' })
      if (c !== 0) return c
      const nA = (a.nome_comercial || '').toString()
      const nB = (b.nome_comercial || '').toString()
      return nA.localeCompare(nB, 'pt-BR', { sensitivity: 'base' })
    })

  // Group by category (used when no category filter is active)
  const groupedMedicines = filteredMedicines.reduce((acc, m) => {
    const key = m.categoria || 'Outros'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})
  const sortedCategories = Object.keys(groupedMedicines).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
  )
  const showGrouped = filterCat === 'all' && filterLocal === 'all' && filteredMedicines.length > 0

  const handleDelete = async (id) => {
    if (!confirm('Remover este medicamento?')) return
    await fetch(`/api/medicines/${id}`, { method: 'DELETE', credentials: 'include' })
    toast.success('Medicamento removido')
    setDetailMed(null)
    loadAll()
  }

  const handleQuickQuantity = async (med, delta) => {
    const newQ = Math.max(0, (med.quantidade || 0) + delta)
    const res = await fetch(`/api/medicines/${med.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantidade: newQ }),
    })
    if (res.ok) {
      toast.success(`Quantidade: ${newQ}`)
      loadAll()
      if (detailMed?.id === med.id) {
        const updated = await res.json()
        setDetailMed(updated)
      }
    }
  }

  const catCount = Object.keys(stats.categories || {}).length

  // Compute unique locations from all medicines
  const locationCounts = {}
  let unlabeledCount = 0
  for (const m of medicines) {
    const loc = (m.local || '').trim()
    if (loc) locationCounts[loc] = (locationCounts[loc] || 0) + 1
    else unlabeledCount++
  }
  const sortedLocations = Object.keys(locationCounts).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
  )
  const hasLocations = sortedLocations.length > 0 || unlabeledCount > 0

  // ============ LOGIN SCREEN ============
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
        </div>
      </div>
    )
  }

  // Opened from the password-reset email: show the "new password" form,
  // even if a stale session cookie exists (the reset revokes sessions).
  if (resetToken) {
    return (
      <LoginScreen
        initialTab="login"
        resetToken={resetToken}
        onGoogleLogin={doLogin}
        onLoggedIn={(u) => setUser(u)}
        onResetDone={() => {
          window.history.replaceState({}, '', window.location.pathname)
          setResetToken(null)
          setUser(null)
          setAuthMode('login')
        }}
      />
    )
  }

  if (!user) {
    if (!authMode) {
      return <LandingScreen onGetStarted={(mode) => setAuthMode(mode)} />
    }
    return (
      <LoginScreen
        initialTab={authMode}
        onGoogleLogin={doLogin}
        onLoggedIn={(u) => setUser(u)}
        onBack={() => setAuthMode(null)}
      />
    )
  }

  return (
    <div className="min-h-screen">
      <Toaster position="top-center" richColors offset="calc(var(--safe-area-inset-top, 0px) + 12px)" mobileOffset="calc(var(--safe-area-inset-top, 0px) + 12px)" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shrink-0">
              <Pill className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-lg tracking-tight leading-none">HomeMed AI</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{user.name || user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" title="Exportar" data-tour="export">
                  <Download className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Exportar farmácia</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    if (medicines.length === 0) { toast.error('Nenhum medicamento para exportar'); return }
                    exportToPDF(medicines)
                    toast.success('PDF gerado')
                  }}
                >
                  <FileText className="h-4 w-4 mr-2 text-red-600" />
                  PDF (relatório)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (medicines.length === 0) { toast.error('Nenhum medicamento para exportar'); return }
                    exportToExcel(medicines)
                    toast.success('Excel gerado')
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (medicines.length === 0) { toast.error('Nenhum medicamento para exportar'); return }
                    exportToCSV(medicines)
                    toast.success('CSV gerado')
                  }}
                >
                  <File className="h-4 w-4 mr-2 text-blue-600" />
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTravelOpen(true)}>
                  <Package className="h-4 w-4 mr-2 text-emerald-600" />
                  Lista de viagem
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {DOSE_REMINDERS_ENABLED && medicines.some(m => normalizeDoseTimes(m.dose_times).length > 0) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDosesOpen(true)}
                className="rounded-full"
                aria-label="Doses de hoje"
              >
                <Pill className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              data-tour="settings"
              onClick={() => setSettingsOpen(true)}
              className="rounded-full"
              aria-label="Configurações"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleTheme()}
              className="rounded-full"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button data-tour="profile" className="rounded-full ring-1 ring-border hover:ring-primary/50 transition overflow-hidden shrink-0" aria-label="Perfil">
                  {user.picture ? (
                    <img src={user.picture} alt="" className="w-8 h-8 object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center font-semibold text-xs">
                      {(user.name || user.email || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium truncate">{user.name}</div>
                  <div className="text-xs text-muted-foreground truncate font-normal">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFamilyOpen(true)}>
                  <Users className="h-4 w-4 mr-2 text-blue-600" /> Compartilhamento familiar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Settings className="h-4 w-4 mr-2 text-slate-600" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAccountOpen(true)}>
                  <ShieldAlert className="h-4 w-4 mr-2 text-amber-600" /> Gerenciar conta
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/privacy" target="_blank" rel="noopener noreferrer">
                    <Info className="h-4 w-4 mr-2 text-slate-500" /> Política de Privacidade
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/terms" target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4 mr-2 text-slate-500" /> Termos de Uso
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={doLogout} className="text-red-600 focus:text-red-600">
                  <LogOut className="h-4 w-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 pb-28 pt-5 space-y-6">
        {/* Hero / Search */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-emerald-500 p-5 sm:p-6 text-white shadow-lg">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl"></div>
          <div className="absolute -left-4 -bottom-4 h-32 w-32 rounded-full bg-emerald-300/20 blur-2xl"></div>
          <div className="relative">
            <h2 className="text-xl sm:text-2xl font-bold leading-tight">Olá! O que você precisa hoje?</h2>
            <p className="text-blue-50/90 text-sm mt-1">Cadastre com IA, controle validades e estoque da sua casa.</p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, princípio ativo, local..."
                  className="pl-9 bg-white text-slate-900 border-0 h-11"
                />
              </div>
              <Button
                data-tour="add"
                onClick={() => setAddOpen(true)}
                className="h-11 bg-white text-blue-700 hover:bg-blue-50 font-semibold gap-2 shadow-md"
              >
                <Sparkles className="h-4 w-4" /> Cadastrar com IA
              </Button>
            </div>
          </div>
        </section>

        {/* Stats grid */}
        <section data-tour="stats" className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <StatCard
            icon={Boxes}
            label="Medicamentos"
            value={stats.total}
            color="bg-gradient-to-br from-blue-500 to-blue-600"
            subtitle={`${catCount} categorias`}
            onClick={() => { setStatusFilter('all'); setFilterCat('all') }}
            active={statusFilter === 'all' && filterCat === 'all'}
          />
          <StatCard
            icon={CalendarClock}
            label="Vencendo em breve"
            value={stats.expiring}
            color="bg-gradient-to-br from-orange-500 to-amber-600"
            subtitle="próximos 90 dias"
            onClick={() => setStatusFilter(statusFilter === 'expiring' ? 'all' : 'expiring')}
            active={statusFilter === 'expiring'}
          />
          <StatCard
            icon={ShieldAlert}
            label="Vencidos"
            value={stats.expired}
            color="bg-gradient-to-br from-red-500 to-red-600"
            subtitle="descartar"
            onClick={() => setStatusFilter(statusFilter === 'expired' ? 'all' : 'expired')}
            active={statusFilter === 'expired'}
          />
          <StatCard
            icon={TrendingDown}
            label="Estoque baixo"
            value={stats.low_stock}
            color="bg-gradient-to-br from-emerald-500 to-emerald-600"
            subtitle="abaixo do mínimo"
            onClick={() => setStatusFilter(statusFilter === 'low_stock' ? 'all' : 'low_stock')}
            active={statusFilter === 'low_stock'}
          />
        </section>

        {/* Categories */}
        {catCount > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Categorias</h3>
              {filterCat !== 'all' && (
                <Button variant="ghost" size="sm" onClick={() => setFilterCat('all')} className="h-7 text-xs">
                  <X className="h-3 w-3 mr-1" /> Limpar filtro
                </Button>
              )}
            </div>
            <CategoryScroller>
              {Object.entries(stats.categories).map(([cat, count]) => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat === filterCat ? 'all' : cat)}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                    filterCat === cat
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {cat} <span className="opacity-70">· {count}</span>
                </button>
              ))}
            </CategoryScroller>
          </section>
        )}

        {/* Locations filter */}
        {hasLocations && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Locais
              </h3>
              {filterLocal !== 'all' && (
                <Button variant="ghost" size="sm" onClick={() => setFilterLocal('all')} className="h-7 text-xs">
                  <X className="h-3 w-3 mr-1" /> Limpar filtro
                </Button>
              )}
            </div>
            <CategoryScroller>
              {sortedLocations.map(loc => (
                <button
                  key={loc}
                  onClick={() => setFilterLocal(loc === filterLocal ? 'all' : loc)}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition inline-flex items-center gap-1.5 ${
                    filterLocal === loc
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-card hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <MapPin className="h-3 w-3" />
                  {loc} <span className="opacity-70">· {locationCounts[loc]}</span>
                </button>
              ))}
              {unlabeledCount > 0 && (
                <button
                  onClick={() => setFilterLocal(filterLocal === '__none__' ? 'all' : '__none__')}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition italic ${
                    filterLocal === '__none__'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-card hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  Sem local <span className="opacity-70">· {unlabeledCount}</span>
                </button>
              )}
            </CategoryScroller>
          </section>
        )}

        {/* Medicines list */}
        <section>
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="font-semibold text-lg min-w-0 truncate">
              {statusFilter === 'expiring' && 'Vencendo em breve'}
              {statusFilter === 'expired' && 'Vencidos'}
              {statusFilter === 'low_stock' && 'Estoque baixo'}
              {statusFilter === 'all' && filterLocal !== 'all' && filterLocal !== '__none__' && `Em ${filterLocal}`}
              {statusFilter === 'all' && filterLocal === '__none__' && 'Sem local definido'}
              {statusFilter === 'all' && filterLocal === 'all' && (filterCat !== 'all' ? filterCat : 'Meus medicamentos')}
              <span className="text-muted-foreground text-sm font-normal ml-2">({filteredMedicines.length})</span>
            </h3>
            {(statusFilter !== 'all' || filterCat !== 'all' || filterLocal !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setStatusFilter('all'); setFilterCat('all'); setFilterLocal('all') }}
                className="h-8 text-xs shrink-0"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Limpar
              </Button>
            )}
          </div>

          {loading && medicines.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : filteredMedicines.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <Archive className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="font-medium">
                  {statusFilter === 'expired' && 'Nenhum medicamento vencido 🎉'}
                  {statusFilter === 'expiring' && 'Nenhum medicamento vencendo em breve 👍'}
                  {statusFilter === 'low_stock' && 'Nenhum medicamento com estoque baixo 👌'}
                  {statusFilter === 'all' && filterCat !== 'all' && `Nada em ${filterCat}`}
                  {statusFilter === 'all' && filterCat === 'all' && 'Nenhum medicamento ainda'}
                </p>
                {statusFilter === 'all' && filterCat === 'all' && (
                  <>
                    <p className="text-sm text-muted-foreground mt-1 px-12 sm:px-0">Comece cadastrando seu primeiro medicamento com IA.</p>
                    <Button className="mt-4 gap-2" onClick={() => setAddOpen(true)}>
                      <Sparkles className="h-4 w-4" /> Cadastrar com IA
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            showGrouped ? (
              <div className="space-y-6">
                {sortedCategories.map(cat => (
                  <div key={cat}>
                    <div className="flex items-baseline justify-between gap-3 mb-2 sticky top-[57px] bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm py-1.5 z-10 -mx-1 px-1 rounded">
                      <div className="flex items-center gap-2 min-w-0">
                        <CategoryBadge cat={cat} />
                        <span className="text-xs text-muted-foreground shrink-0">{groupedMedicines[cat].length}</span>
                      </div>
                      <button
                        onClick={() => setFilterCat(cat)}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        Ver só {cat.toLowerCase()}
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {groupedMedicines[cat].map(m => (
                        <MedicineCard key={m.id} m={m} onClick={() => setDetailMed(m)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredMedicines.map(m => (
                  <MedicineCard key={m.id} m={m} onClick={() => setDetailMed(m)} />
                ))}
              </div>
            )
          )}
        </section>
      </main>

      {/* Floating AI assistant button */}
      <button
        data-tour="assistant"
        onClick={() => setAiOpen(true)}
        className="fixed bottom-[calc(6rem+var(--safe-area-inset-bottom,0px))] right-4 sm:bottom-6 sm:right-6 h-14 w-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all z-30 flex items-center justify-center"
        aria-label="Assistente IA"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Floating Add button (mobile) */}
      <button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-[calc(1.5rem+var(--safe-area-inset-bottom,0px))] right-4 sm:hidden h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all z-30 flex items-center justify-center"
        aria-label="Adicionar"
      >
        <Plus className="h-6 w-6" />
      </button>

      {addOpen && (
        <AddMedicineDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onSaved={loadAll}
          onOpenExisting={(m) => setDetailMed(m)}
        />
      )}
      {editMed && (
        <AddMedicineDialog
          open={!!editMed}
          onOpenChange={(o) => !o && setEditMed(null)}
          onSaved={loadAll}
          editMed={editMed}
        />
      )}
      {detailMed && (
        <MedicineDetailSheet
          med={detailMed}
          onClose={() => setDetailMed(null)}
          onDelete={() => handleDelete(detailMed.id)}
          onQty={(d) => handleQuickQuantity(detailMed, d)}
          onEdit={() => { const m = detailMed; setDetailMed(null); setEditMed(m) }}
        />
      )}
      {aiOpen && <AIAssistantSheet open={aiOpen} onOpenChange={setAiOpen} />}
      {familyOpen && (
        <FamilyDialog
          open={familyOpen}
          onOpenChange={setFamilyOpen}
          currentEmail={user.email}
          onChanged={() => { loadAll() }}
        />
      )}
      {DOSE_REMINDERS_ENABLED && (
        <DosesSheet open={dosesOpen} onOpenChange={setDosesOpen} medicines={medicines} onChanged={() => { loadAll() }} />
      )}
      {travelOpen && <TravelListDialog open={travelOpen} onOpenChange={setTravelOpen} medicines={medicines} />}
      <GuidedTour open={tourOpen} onFinish={finishTour} />
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        prefs={notifPrefs}
        onChange={updateNotifPrefs}
        permission={notifPermission}
        onRequestPermission={askNotificationPermission}
        onSendTest={testNotification}
        nextReminder={nextReminder}
        native={isNativeApp()}
        needsUpdate={appNeedsUpdate()}
        lastSync={lastSync}
        syncing={syncing}
        onSync={syncNow}
        onStartTour={startTour}
      />
      {accountOpen && (
        <AccountDialog
          open={accountOpen}
          onOpenChange={setAccountOpen}
          user={user}
          onGone={() => { setUser(null); setMedicines([]); setStats({ total: 0, expired: 0, expiring: 0, low_stock: 0, categories: {}, last_added: [] }) }}
        />
      )}
    </div>
  )
}

export default App
