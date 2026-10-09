'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTheme } from 'next-themes'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { SocialLogin } from '@capgo/capacitor-social-login'
import { SafeArea } from '@capacitor-community/safe-area'
import { useAndroidBack } from '@/lib/useAndroidBack'
import { toast, Toaster } from 'sonner'
import { Search, Plus, Loader2, MessageCircle, Settings } from 'lucide-react'
import { DEFAULT_NOTIFICATION_PREFS, normalizeNotificationPrefs } from '@/lib/notification-prefs'
import { getNotificationPermission } from '@/lib/notifications'
import { LandingScreen } from '@/components/app/LandingScreen'
import { LoginScreen } from '@/components/app/LoginScreen'
import { AppHeader } from '@/components/app/AppHeader'
import { SearchHero, StatsGrid, FilterBars, MedicineList } from '@/components/app/DashboardSections'
import { AppDialogs } from '@/components/app/AppDialogs'
import { useReminders } from '@/components/app/useReminders'

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

  const { updateNotifPrefs, askNotificationPermission, testNotification } = useReminders({ medicines, notifPermission, notifPrefs, notifPrefsRef, prefsLoaded, saveTimer, setDosesOpen, setFilterCat, setNextReminder, setNotifPermission, setNotifPrefs, setSearch, setSettingsOpen, setStatusFilter, tourDone, tourOpen, user })

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
      <AppHeader theme={theme} doLogout={doLogout} medicines={medicines} setAccountOpen={setAccountOpen} setDosesOpen={setDosesOpen} setFamilyOpen={setFamilyOpen} setSettingsOpen={setSettingsOpen} setTravelOpen={setTravelOpen} toggleTheme={toggleTheme} user={user} />

      <main className="container mx-auto max-w-6xl px-4 pb-28 pt-5 space-y-6">
        {/* Hero / Search */}
        <SearchHero search={search} setAddOpen={setAddOpen} setSearch={setSearch} />
        {/* Stats grid */}
        <StatsGrid catCount={catCount} filterCat={filterCat} setFilterCat={setFilterCat} setStatusFilter={setStatusFilter} stats={stats} statusFilter={statusFilter} />
        {/* Categories */}
        <FilterBars unlabeledCount={unlabeledCount} catCount={catCount} filterCat={filterCat} filterLocal={filterLocal} hasLocations={hasLocations} locationCounts={locationCounts} setFilterCat={setFilterCat} setFilterLocal={setFilterLocal} sortedLocations={sortedLocations} stats={stats} />
        {/* Medicines list */}
        <MedicineList filterCat={filterCat} filterLocal={filterLocal} filteredMedicines={filteredMedicines} groupedMedicines={groupedMedicines} loading={loading} medicines={medicines} setAddOpen={setAddOpen} setDetailMed={setDetailMed} setFilterCat={setFilterCat} setFilterLocal={setFilterLocal} setStatusFilter={setStatusFilter} showGrouped={showGrouped} sortedCategories={sortedCategories} statusFilter={statusFilter} />
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

      <AppDialogs accountOpen={accountOpen} addOpen={addOpen} aiOpen={aiOpen} askNotificationPermission={askNotificationPermission} detailMed={detailMed} dosesOpen={dosesOpen} editMed={editMed} familyOpen={familyOpen} finishTour={finishTour} handleDelete={handleDelete} handleQuickQuantity={handleQuickQuantity} lastSync={lastSync} loadAll={loadAll} medicines={medicines} nextReminder={nextReminder} notifPermission={notifPermission} notifPrefs={notifPrefs} setAccountOpen={setAccountOpen} setAddOpen={setAddOpen} setAiOpen={setAiOpen} setDetailMed={setDetailMed} setDosesOpen={setDosesOpen} setEditMed={setEditMed} setFamilyOpen={setFamilyOpen} setMedicines={setMedicines} setSettingsOpen={setSettingsOpen} setStats={setStats} setTravelOpen={setTravelOpen} setUser={setUser} settingsOpen={settingsOpen} startTour={startTour} syncNow={syncNow} syncing={syncing} testNotification={testNotification} tourOpen={tourOpen} travelOpen={travelOpen} updateNotifPrefs={updateNotifPrefs} user={user} />
    </div>
  )
}

export default App
