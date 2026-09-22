'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { toast, Toaster } from 'sonner'
import {
  Pill, Search, Plus, Sparkles, AlertTriangle, CalendarClock, Package, Boxes,
  Trash2, Edit2, MapPin, FlaskConical, Moon, Sun, Loader2, MessageCircle, X,
  ChevronRight, ChevronLeft, Check, ShieldAlert, Info, Send, TrendingDown, Archive,
  ScanLine, Download, FileText, FileSpreadsheet, File, Barcode, LogOut, Bell,
  Users, Copy, UserPlus, UserMinus, RefreshCw,
} from 'lucide-react'
import BarcodeScanner from '@/components/barcode-scanner'
import { exportToPDF, exportToExcel, exportToCSV } from '@/lib/export'

const CATEGORIA_COLORS = {
  'Analgésico': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  'Antialérgico': 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  'Antibiótico': 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  'Anti-inflamatório': 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  'Antigripal': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
  'Antiviral': 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
  'Antifúngico': 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  'Gastrointestinal': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  'Vitaminas': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  'Pomadas': 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  'Colírios': 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  'Controlados': 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  'Pressão arterial': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  'Diabetes': 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  'Uso contínuo': 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  'Primeiros socorros': 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  'Outros': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

const FORMAS = ['Comprimido', 'Cápsula', 'Xarope', 'Pomada', 'Injetável', 'Spray', 'Colírio', 'Gotas', 'Sachê', 'Outro']

function ExpiryBadge({ status, days }) {
  if (status === 'expired') return <Badge className="bg-red-600 hover:bg-red-600 text-white gap-1"><ShieldAlert className="h-3 w-3"/>Vencido</Badge>
  if (status === 'critical') return <Badge className="bg-red-500 hover:bg-red-500 text-white gap-1"><AlertTriangle className="h-3 w-3"/>{days}d</Badge>
  if (status === 'warning_30') return <Badge className="bg-orange-500 hover:bg-orange-500 text-white gap-1"><CalendarClock className="h-3 w-3"/>{days}d</Badge>
  if (status === 'warning_60') return <Badge className="bg-yellow-500 hover:bg-yellow-500 text-white gap-1"><CalendarClock className="h-3 w-3"/>{days}d</Badge>
  if (status === 'warning_90') return <Badge className="bg-blue-500 hover:bg-blue-500 text-white gap-1"><CalendarClock className="h-3 w-3"/>{days}d</Badge>
  if (status === 'ok') return <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-400">{days}d</Badge>
  return <Badge variant="outline">—</Badge>
}

function CategoryBadge({ cat }) {
  const cls = CATEGORIA_COLORS[cat] || CATEGORIA_COLORS['Outros']
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{cat || 'Outros'}</span>
}

function StatCard({ icon: Icon, label, value, color, subtitle, onClick, active }) {  return (
    <button onClick={onClick} className="text-left w-full group">
      <Card className={`hover:shadow-lg transition-all hover:-translate-y-0.5 h-full border-0 shadow-sm ${
        active ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg -translate-y-0.5' : ''
      }`}>
        <CardContent className="p-3 sm:p-5">
          <div className="flex items-start justify-between gap-1">
            <div className={`p-2 sm:p-2.5 rounded-xl ${color} shrink-0`}>
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            {active
              ? <Check className="h-4 w-4 text-primary shrink-0" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0" />
            }
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-xl sm:text-3xl font-bold tracking-tight leading-none">{value}</div>
            <div className="text-[11px] sm:text-sm text-muted-foreground mt-1 leading-tight">{label}</div>
            {subtitle && <div className="text-[10px] sm:text-[11px] text-muted-foreground/70 mt-0.5 leading-tight truncate">{subtitle}</div>}
          </div>
        </CardContent>
      </Card>
    </button>
  )
}

/* ============ CATEGORY SCROLLER (with arrows on desktop hover) ============ */
function CategoryScroller({ children }) {
  const scrollRef = useRef(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanLeft(scrollLeft > 4)
    setCanRight(scrollLeft + clientWidth < scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    // Update after children change
    const mo = new MutationObserver(update)
    mo.observe(el, { childList: true, subtree: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [update])

  const scrollBy = (dir) => {
    const el = scrollRef.current
    if (!el) return
    const amount = Math.max(160, Math.floor(el.clientWidth * 0.7))
    el.scrollBy({ left: dir * amount, behavior: 'smooth' })
  }

  return (
    <div className="relative group">
      {/* Fade left */}
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 z-10 bg-gradient-to-r from-background to-transparent transition-opacity ${
          canLeft ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {/* Left arrow — only on devices with hover (desktop) */}
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        aria-label="Rolar para esquerda"
        className={`hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 h-8 w-8 items-center justify-center rounded-full bg-background border shadow-md hover:bg-accent hover:scale-105 transition-all
          ${canLeft ? 'opacity-0 group-hover:opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto no-scrollbar pb-1 scroll-smooth"
      >
        {children}
      </div>

      {/* Fade right */}
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 w-8 z-10 bg-gradient-to-l from-background to-transparent transition-opacity ${
          canRight ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {/* Right arrow */}
      <button
        type="button"
        onClick={() => scrollBy(1)}
        aria-label="Rolar para direita"
        className={`hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 h-8 w-8 items-center justify-center rounded-full bg-background border shadow-md hover:bg-accent hover:scale-105 transition-all
          ${canRight ? 'opacity-0 group-hover:opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

/* ============ MEDICINE CARD ============ */
function MedicineCard({ m, onClick }) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition group border-0 shadow-sm overflow-hidden"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-emerald-100 dark:from-blue-950 dark:to-emerald-950 flex items-center justify-center shrink-0">
                <Pill className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{m.nome_comercial}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 break-anywhere">
                  {m.principio_ativo || m.nome_generico || m.forma_farmaceutica}
                  {m.concentracao ? ` · ${m.concentracao}` : ''}
                </p>
              </div>
            </div>
          </div>
          <div className="shrink-0"><ExpiryBadge status={m.expiry_status} days={m.days_until_expiry} /></div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
          <CategoryBadge cat={m.categoria} />
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Package className="h-3 w-3" />
            <span className="font-semibold text-foreground">{m.quantidade ?? 0}</span>
            {m.forma_farmaceutica && <span className="hidden xs:inline">· {m.forma_farmaceutica}</span>}
          </div>
        </div>
        {m.local && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{m.local}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}


/* ============ LOGIN SCREEN ============ */
function LoginScreen({ onGoogleLogin, onLoggedIn }) {
  const [tab, setTab] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!email.includes('@')) return toast.error('Informe um email válido')
    if (password.length < 6) return toast.error('Senha deve ter ao menos 6 caracteres')
    setLoading(true)
    try {
      const url = tab === 'register' ? '/api/auth/register' : '/api/auth/login'
      const body = tab === 'register' ? { email, password, name } : { email, password }
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao autenticar')
      toast.success(tab === 'register' ? `Bem-vindo, ${data.name || data.email}!` : `Olá, ${data.name || data.email}!`)
      onLoggedIn(data)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-emerald-50 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950">
      <Toaster position="top-center" richColors />
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardContent className="p-6 sm:p-8 space-y-5">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg">
              <Pill className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">HomeMed</h1>
              <p className="text-sm text-muted-foreground mt-1">Sua farmácia doméstica inteligente</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setTab('login')}
              className={`py-2 text-sm font-medium rounded-md transition ${tab === 'login' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
            >
              Entrar
            </button>
            <button
              onClick={() => setTab('register')}
              className={`py-2 text-sm font-medium rounded-md transition ${tab === 'register' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
            >
              Criar conta
            </button>
          </div>

          {/* Form */}
          <div className="space-y-3">
            {tab === 'register' && (
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" />
              </div>
            )}
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
            </div>
            <div>
              <Label className="text-xs">Senha</Label>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showPass ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
            <Button onClick={submit} disabled={loading} className="w-full h-11 gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {tab === 'register' ? 'Criar minha conta' : 'Entrar'}
            </Button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-border"></div>
          </div>

          {/* Google */}
          <Button onClick={onGoogleLogin} className="w-full h-11 gap-3 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 shadow-sm">
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar com Google
          </Button>

          <p className="text-[11px] text-center text-muted-foreground">
            Seus medicamentos ficam privados e associados apenas à sua conta.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}


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

  const loadAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterCat && filterCat !== 'all') params.set('categoria', filterCat)
      const [medRes, statRes] = await Promise.all([
        fetch('/api/medicines?' + params.toString(), { credentials: 'include' }),
        fetch('/api/stats', { credentials: 'include' }),
      ])
      const medData = await medRes.json()
      const statData = await statRes.json()
      setMedicines(medData.medicines || [])
      setStats(statData)
    } catch (e) {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [search, filterCat, user])

  // ============ AUTH ============
  useEffect(() => {
    async function bootstrap() {
      try {
        // 1. Check if we have session_id in URL fragment (from Emergent redirect)
        if (typeof window !== 'undefined' && window.location.hash.startsWith('#session_id=')) {
          const sessionId = window.location.hash.replace('#session_id=', '')
          window.history.replaceState({}, document.title, window.location.pathname)
          const res = await fetch('/api/auth/session', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId }),
          })
          if (res.ok) {
            const data = await res.json()
            setUser(data)
            toast.success(`Bem-vindo, ${data.name || data.email}!`)
          } else {
            toast.error('Falha ao autenticar')
          }
        } else {
          // 2. Check cookie session
          const res = await fetch('/api/auth/me', { credentials: 'include' })
          const data = await res.json()
          setUser(data.user)
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

  // ============ NOTIFICATIONS: register SW + schedule local notifications ============
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW register failed', err))
  }, [])

  useEffect(() => {
    if (!user || medicines.length === 0) return
    if (typeof window === 'undefined' || !('Notification' in window)) return

    const scheduleAll = async () => {
      if (Notification.permission === 'default') {
        try { await Notification.requestPermission() } catch { /* ignore */ }
      }
      if (Notification.permission !== 'granted') return

      const reg = await navigator.serviceWorker?.ready?.catch(() => null)

      const today = new Date().toISOString().slice(0, 10)
      const notifiedKey = `homemed_notified_${user.email}_${today}`
      const alreadyNotified = new Set(JSON.parse(localStorage.getItem(notifiedKey) || '[]'))

      // 1) Show notifications for meds expiring TODAY (fallback for browsers without TimestampTrigger)
      const expiringToday = medicines.filter(m => m.days_until_expiry === 0 && !alreadyNotified.has(m.id))
      for (const m of expiringToday) {
        try {
          const options = {
            body: `${m.nome_comercial}${m.concentracao ? ' ' + m.concentracao : ''} vence HOJE. Considere descartar.`,
            icon: '/icon-192.svg',
            tag: `expire-${m.id}`,
            data: { medicine_id: m.id, url: '/' },
          }
          if (reg) {
            await reg.showNotification('HomeMed — Medicamento vencendo HOJE', options)
          } else {
            new Notification('HomeMed — Medicamento vencendo HOJE', options)
          }
          alreadyNotified.add(m.id)
        } catch { /* ignore */ }
      }
      localStorage.setItem(notifiedKey, JSON.stringify([...alreadyNotified]))

      // 2) Schedule future notifications for meds expiring later using TimestampTrigger
      //    Supported on Chrome/Samsung Internet (Chromium-based). Fires even when app closed.
      if (!reg || typeof window.TimestampTrigger === 'undefined') return

      const scheduledKey = `homemed_scheduled_${user.email}`
      const scheduledSet = new Set(JSON.parse(localStorage.getItem(scheduledKey) || '[]'))

      for (const m of medicines) {
        if (!m.data_validade) continue
        const validade = new Date(m.data_validade)
        if (isNaN(validade)) continue
        // Schedule at 9 AM on the expiration day
        validade.setHours(9, 0, 0, 0)
        const now = Date.now()
        const trigger = validade.getTime()
        if (trigger <= now) continue
        const key = `sched-${m.id}-${m.data_validade}`
        if (scheduledSet.has(key)) continue

        try {
          await reg.showNotification('HomeMed — Medicamento vencendo HOJE', {
            body: `${m.nome_comercial}${m.concentracao ? ' ' + m.concentracao : ''} vence hoje. Considere descartar.`,
            icon: '/icon-192.svg',
            tag: `expire-${m.id}`,
            data: { medicine_id: m.id, url: '/' },
            showTrigger: new window.TimestampTrigger(trigger),
          })
          scheduledSet.add(key)
        } catch (e) {
          // TimestampTrigger might throw on unsupported browsers
          console.warn('Schedule failed for', m.nome_comercial, e)
        }
      }
      localStorage.setItem(scheduledKey, JSON.stringify([...scheduledSet]))
    }
    scheduleAll()
  }, [user, medicines])

  const doLogin = () => {
    const cb = encodeURIComponent(window.location.origin + window.location.pathname)
    window.location.href = `https://auth.emergentagent.com/?redirect=${cb}`
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

  if (!user) {
    return <LoginScreen onGoogleLogin={doLogin} onLoggedIn={(u) => setUser(u)} />
  }

  return (
    <div className="min-h-screen">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shrink-0">
              <Pill className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-lg tracking-tight leading-none">HomeMed</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{user.name || user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" title="Exportar">
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
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-full"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full ring-1 ring-border hover:ring-primary/50 transition overflow-hidden shrink-0" aria-label="Perfil">
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
                onClick={() => setAddOpen(true)}
                className="h-11 bg-white text-blue-700 hover:bg-blue-50 font-semibold gap-2 shadow-md"
              >
                <Sparkles className="h-4 w-4" /> Cadastrar com IA
              </Button>
            </div>
          </div>
        </section>

        {/* Stats grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
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
                    <p className="text-sm text-muted-foreground mt-1">Comece cadastrando seu primeiro medicamento com IA.</p>
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
        onClick={() => setAiOpen(true)}
        className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 h-14 w-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all z-30 flex items-center justify-center"
        aria-label="Assistente IA"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Floating Add button (mobile) */}
      <button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-6 right-4 sm:hidden h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all z-30 flex items-center justify-center"
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

/* ============ ADD MEDICINE DIALOG ============ */
function AddMedicineDialog({ open, onOpenChange, onSaved, editMed, onOpenExisting }) {
  const isEdit = !!editMed
  const [aiInput, setAiInput] = useState('')
  const [enriching, setEnriching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(isEdit ? { ...emptyForm(''), ...editMed } : null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannedCode, setScannedCode] = useState(isEdit ? (editMed.codigo_barras || '') : '')

  const handleBarcode = (code) => {
    setScannerOpen(false)
    setScannedCode(code)
    toast.success(`Código lido: ${code}`)
    if (form) {
      setForm(f => ({ ...f, codigo_barras: code }))
    }
  }

  const handleEnrich = async () => {
    if (!aiInput.trim()) return
    setEnriching(true)
    try {
      const res = await fetch('/api/ai/enrich', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: aiInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro na IA')
      if (data.reconhecido === false) {
        toast.error(data.motivo || 'Medicamento não reconhecido. Use cadastro manual.')
        setForm(emptyForm(aiInput))
        return
      }
      setForm({
        nome_comercial: data.nome_comercial || aiInput,
        nome_generico: data.nome_generico || '',
        principio_ativo: data.principio_ativo || '',
        laboratorio: data.laboratorio_comum || '',
        concentracao: data.concentracao || '',
        forma_farmaceutica: data.forma_farmaceutica || 'Comprimido',
        categoria: data.categoria || 'Outros',
        classe_terapeutica: data.classe_terapeutica || '',
        para_que_serve: data.para_que_serve || '',
        indicacoes: data.indicacoes || [],
        contraindicacoes: data.contraindicacoes || [],
        efeitos_colaterais: data.efeitos_colaterais || [],
        precisa_receita: !!data.precisa_receita,
        uso_continuo: !!data.uso_continuo_comum,
        modo_armazenamento: data.modo_armazenamento || '',
        lote: '',
        data_fabricacao: '',
        data_validade: '',
        quantidade: 1,
        quantidade_minima: 1,
        local: '',
        observacoes: '',
        codigo_barras: scannedCode || '',
      })
      toast.success('IA preencheu os dados! Confira e salve.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setEnriching(false)
    }
  }

  const handleSave = async () => {
    if (!form?.nome_comercial?.trim()) {
      toast.error('Informe o nome do medicamento')
      return
    }
    setSaving(true)
    try {
      // Strip server-computed / mongo fields
      const { _id, expiry_status, days_until_expiry, history, created_at, updated_at, id, ...payload } = form
      const url = isEdit ? `/api/medicines/${editMed.id}` : '/api/medicines'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      toast.success(isEdit ? 'Medicamento atualizado!' : 'Medicamento cadastrado!')
      onSaved()
      onOpenChange(false)
      setForm(null)
      setAiInput('')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setForm(null); setAiInput(''); } }}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            {isEdit ? <Edit2 className="h-5 w-5 text-blue-600 shrink-0" /> : <Sparkles className="h-5 w-5 text-blue-600 shrink-0" />}
            <span className="truncate">{isEdit ? 'Editar medicamento' : 'Cadastrar medicamento'}</span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isEdit ? 'Atualize as informações e salve.' : 'Digite o nome e a IA preenche todo o resto automaticamente.'}
          </DialogDescription>
        </DialogHeader>

        {!form ? (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-dashed border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900">
                  <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold">Cadastro inteligente</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Digite o nome comercial (ex: <b>Novalgina</b>, <b>Tylenol</b>, <b>Allegra</b>) ou o princípio ativo (ex: <b>Dipirona</b>).
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  autoFocus
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Ex: Novalgina 500mg"
                  onKeyDown={(e) => e.key === 'Enter' && handleEnrich()}
                  className="h-11"
                />
                <Button onClick={handleEnrich} disabled={enriching || !aiInput.trim()} className="h-11 gap-2">
                  {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {enriching ? 'Buscando...' : 'Buscar com IA'}
                </Button>
              </div>

              {scannedCode && (
                <div className="mt-3 flex items-center gap-2 text-xs bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-2">
                  <Barcode className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="font-mono">{scannedCode}</span>
                  <button
                    onClick={() => setScannedCode('')}
                    className="ml-auto text-muted-foreground hover:text-foreground"
                    aria-label="Limpar código"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setScannerOpen(true)}
                className="h-11 gap-2"
              >
                <ScanLine className="h-4 w-4" />
                Escanear código
              </Button>
              <Button
                variant="outline"
                onClick={() => setForm({ ...emptyForm(aiInput), codigo_barras: scannedCode })}
                className="h-11 gap-2"
              >
                <Edit2 className="h-4 w-4" />
                Manual
              </Button>
            </div>
          </div>
        ) : (
          <MedicineForm form={form} setForm={setForm} onScan={() => setScannerOpen(true)} />
        )}

        <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
          {form && (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  if (isEdit) {
                    onOpenChange(false)
                  } else {
                    setForm(null); setAiInput('')
                  }
                }}
              >
                {isEdit ? 'Cancelar' : 'Voltar'}
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {isEdit ? 'Salvar alterações' : 'Salvar medicamento'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleBarcode}
      />
    </Dialog>
  )
}

function emptyForm(name) {
  return {
    nome_comercial: name || '',
    nome_generico: '',
    principio_ativo: '',
    laboratorio: '',
    concentracao: '',
    forma_farmaceutica: 'Comprimido',
    categoria: 'Outros',
    classe_terapeutica: '',
    para_que_serve: '',
    indicacoes: [],
    contraindicacoes: [],
    efeitos_colaterais: [],
    precisa_receita: false,
    uso_continuo: false,
    modo_armazenamento: '',
    lote: '',
    data_fabricacao: '',
    data_validade: '',
    quantidade: 1,
    quantidade_minima: 1,
    local: '',
    observacoes: '',
    codigo_barras: '',
  }
}

function MedicineForm({ form, setForm, onScan }) {
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="space-y-4">
      {form.para_que_serve && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 flex gap-2 text-sm">
          <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900 dark:text-blue-200">{form.para_que_serve}</p>
            {form.classe_terapeutica && (
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">Classe: {form.classe_terapeutica}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Nome comercial *">
          <Input value={form.nome_comercial} onChange={e => upd('nome_comercial', e.target.value)} />
        </Field>
        <Field label="Nome genérico">
          <Input value={form.nome_generico} onChange={e => upd('nome_generico', e.target.value)} />
        </Field>
        <Field label="Princípio ativo">
          <Input value={form.principio_ativo} onChange={e => upd('principio_ativo', e.target.value)} />
        </Field>
        <Field label="Laboratório">
          <Input value={form.laboratorio} onChange={e => upd('laboratorio', e.target.value)} />
        </Field>
        <Field label="Concentração">
          <Input value={form.concentracao} onChange={e => upd('concentracao', e.target.value)} placeholder="500mg" />
        </Field>
        <Field label="Forma farmacêutica">
          <Select value={form.forma_farmaceutica} onValueChange={v => upd('forma_farmaceutica', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Categoria">
          <Select value={form.categoria} onValueChange={v => upd('categoria', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.keys(CATEGORIA_COLORS).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Data de validade">
          <Input type="date" value={form.data_validade} onChange={e => upd('data_validade', e.target.value)} />
        </Field>
        <Field label="Quantidade">
          <Input type="number" min="0" value={form.quantidade} onChange={e => upd('quantidade', Number(e.target.value))} />
        </Field>
        <Field label="Quantidade mínima (alerta)">
          <Input type="number" min="0" value={form.quantidade_minima} onChange={e => upd('quantidade_minima', Number(e.target.value))} />
        </Field>
        <Field label="Lote">
          <Input value={form.lote} onChange={e => upd('lote', e.target.value)} />
        </Field>
        <Field label="Data de fabricação">
          <Input type="date" value={form.data_fabricacao} onChange={e => upd('data_fabricacao', e.target.value)} />
        </Field>
        <Field label="Local de armazenamento" full>
          <Input value={form.local} onChange={e => upd('local', e.target.value)} placeholder="Ex: Gaveta banheiro, Armário cozinha" />
        </Field>
        <Field label="Código de barras" full>
          <div className="flex gap-2">
            <Input
              value={form.codigo_barras}
              onChange={e => upd('codigo_barras', e.target.value)}
              placeholder="EAN/UPC..."
              className="font-mono"
            />
            {onScan && (
              <Button type="button" variant="outline" onClick={onScan} className="shrink-0 gap-1">
                <ScanLine className="h-4 w-4" /> Escanear
              </Button>
            )}
          </div>
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Precisa receita?</p>
            <p className="text-xs text-muted-foreground">Controlado / restrito</p>
          </div>
          <Switch checked={form.precisa_receita} onCheckedChange={v => upd('precisa_receita', v)} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Uso contínuo?</p>
            <p className="text-xs text-muted-foreground">Tomado regularmente</p>
          </div>
          <Switch checked={form.uso_continuo} onCheckedChange={v => upd('uso_continuo', v)} />
        </div>
      </div>

      <Field label="Observações">
        <Textarea rows={2} value={form.observacoes} onChange={e => upd('observacoes', e.target.value)} placeholder="Notas adicionais..." />
      </Field>

      {(form.contraindicacoes?.length > 0 || form.efeitos_colaterais?.length > 0) && (
        <div className="rounded-lg border p-3 space-y-2 text-sm">
          {form.contraindicacoes?.length > 0 && (
            <div>
              <p className="font-medium text-orange-700 dark:text-orange-400">Contraindicações</p>
              <p className="text-muted-foreground text-xs">{form.contraindicacoes.join(' · ')}</p>
            </div>
          )}
          {form.efeitos_colaterais?.length > 0 && (
            <div>
              <p className="font-medium text-red-700 dark:text-red-400">Efeitos colaterais</p>
              <p className="text-muted-foreground text-xs">{form.efeitos_colaterais.join(' · ')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, children, full }) {
  return (
    <div className={full ? 'sm:col-span-2 space-y-1' : 'space-y-1'}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

/* ============ MEDICINE DETAIL SHEET ============ */
function MedicineDetailSheet({ med, onClose, onDelete, onQty, onEdit }) {
  return (
    <Sheet open={!!med} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full !max-w-full sm:!max-w-lg overflow-y-auto p-4 sm:p-6 pb-24"
      >
        <SheetHeader className="pr-8">
          <SheetTitle className="text-left text-xl break-anywhere">{med.nome_comercial}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <CategoryBadge cat={med.categoria} />
            <ExpiryBadge status={med.expiry_status} days={med.days_until_expiry} />
            {med.precisa_receita && <Badge variant="outline" className="border-red-300 text-red-700 dark:text-red-400">Requer receita</Badge>}
            {med.uso_continuo && <Badge variant="outline" className="border-violet-300 text-violet-700 dark:text-violet-400">Uso contínuo</Badge>}
          </div>

          {/* Actions row */}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={onEdit} variant="outline" className="gap-2 w-full">
              <Edit2 className="h-4 w-4" /> Editar
            </Button>
            <Button variant="outline" onClick={onDelete} className="gap-2 w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 border-red-200 dark:border-red-900">
              <Trash2 className="h-4 w-4" /> Remover
            </Button>
          </div>

          {med.para_que_serve && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wider">Para que serve</p>
              <p className="text-sm mt-1 break-anywhere">{med.para_que_serve}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Nome genérico" value={med.nome_generico} />
            <InfoRow label="Princípio ativo" value={med.principio_ativo} />
            <InfoRow label="Laboratório" value={med.laboratorio} />
            <InfoRow label="Concentração" value={med.concentracao} />
            <InfoRow label="Forma" value={med.forma_farmaceutica} />
            <InfoRow label="Classe" value={med.classe_terapeutica} />
            <InfoRow label="Lote" value={med.lote} />
            <InfoRow label="Fabricação" value={med.data_fabricacao} />
            <InfoRow label="Validade" value={med.data_validade} />
            <InfoRow label="Local" value={med.local} />
            {med.codigo_barras && <InfoRow label="Código de barras" value={med.codigo_barras} mono full />}
          </div>

          {/* Quantity controls */}
          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Quantidade em estoque</p>
                <p className="text-3xl font-bold">{med.quantidade ?? 0}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="icon" onClick={() => onQty(-1)} disabled={(med.quantidade ?? 0) <= 0}>−</Button>
                <Button variant="outline" size="icon" onClick={() => onQty(1)}>+</Button>
              </div>
            </div>
            {med.quantidade_minima != null && (
              <p className="text-xs text-muted-foreground">Alerta quando ≤ {med.quantidade_minima}</p>
            )}
          </div>

          {med.indicacoes?.length > 0 && (
            <Section title="Indicações">
              <ul className="text-sm space-y-1">
                {med.indicacoes.map((i, k) => (
                  <li key={k} className="flex gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="break-anywhere flex-1 min-w-0">{i}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {med.contraindicacoes?.length > 0 && (
            <Section title="Contraindicações" color="text-orange-700 dark:text-orange-400">
              <ul className="text-sm space-y-1">
                {med.contraindicacoes.map((i, k) => (
                  <li key={k} className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                    <span className="break-anywhere flex-1 min-w-0">{i}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {med.efeitos_colaterais?.length > 0 && (
            <Section title="Efeitos colaterais" color="text-red-700 dark:text-red-400">
              <ul className="text-sm space-y-1">
                {med.efeitos_colaterais.map((i, k) => (
                  <li key={k} className="flex gap-2">
                    <Info className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <span className="break-anywhere flex-1 min-w-0">{i}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {med.modo_armazenamento && (
            <Section title="Armazenamento">
              <p className="text-sm break-anywhere">{med.modo_armazenamento}</p>
            </Section>
          )}

          {med.observacoes && (
            <Section title="Observações">
              <p className="text-sm break-anywhere">{med.observacoes}</p>
            </Section>
          )}

          {med.history?.length > 0 && (
            <Section title="Histórico">
              <ul className="text-xs space-y-1.5">
                {med.history.slice(0, 8).map(h => (
                  <li key={h.id} className="flex justify-between gap-2 border-b pb-1.5 last:border-0">
                    <span className="break-anywhere flex-1 min-w-0">{h.details}</span>
                    <span className="text-muted-foreground shrink-0">{new Date(h.created_at).toLocaleDateString('pt-BR')}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function InfoRow({ label, value, mono, full }) {
  if (!value) return null
  return (
    <div className={`min-w-0 ${full ? 'col-span-2' : ''}`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-medium break-anywhere ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  )
}

function Section({ title, children, color }) {
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${color || 'text-muted-foreground'}`}>{title}</p>
      {children}
    </div>
  )
}

/* ============ AI ASSISTANT SHEET ============ */
/* ============ FAMILY SHARING DIALOG ============ */
function FamilyDialog({ open, onOpenChange, currentEmail, onChanged }) {
  const [loading, setLoading] = useState(true)
  const [family, setFamily] = useState(null)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [newName, setNewName] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/families/me', { credentials: 'include' })
      const data = await res.json()
      setFamily(data.family || null)
    } catch (e) {
      toast.error('Erro ao carregar família')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (open) load() }, [open])

  const createFamily = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/families', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName || 'Minha Família' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao criar')
      setFamily(data.family)
      toast.success('Família criada! Compartilhe o código com sua família.')
      onChanged()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setCreating(false)
    }
  }

  const joinFamily = async () => {
    if (!inviteCode.trim()) return
    setJoining(true)
    try {
      const res = await fetch('/api/families/join', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: inviteCode.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Código inválido')
      toast.success(`Entrou na família ${data.family?.name || ''}!`)
      onChanged()
      await load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setJoining(false)
    }
  }

  const leaveFamily = async () => {
    if (!confirm('Sair da família? Os medicamentos ficarão com os outros membros.')) return
    try {
      await fetch('/api/families/leave', { method: 'POST', credentials: 'include' })
      toast.success('Você saiu da família')
      setFamily(null)
      onChanged()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const removeMember = async (email) => {
    if (!confirm(`Remover ${email} da família?`)) return
    try {
      const res = await fetch(`/api/families/members/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Erro ao remover')
      toast.success('Membro removido')
      await load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const regenCode = async () => {
    try {
      const res = await fetch('/api/families/regenerate-code', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro')
      toast.success('Novo código gerado')
      await load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const copyCode = () => {
    if (!family?.invite_code) return
    navigator.clipboard.writeText(family.invite_code).then(() => {
      toast.success('Código copiado!')
    })
  }

  const isOwner = family && family.owner_email === currentEmail

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Users className="h-5 w-5 text-blue-600 shrink-0" />
            <span>Compartilhamento familiar</span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            Compartilhe sua farmácia com pai, mãe, filhos ou outros familiares.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : family ? (
          <div className="space-y-4">
            <div className="rounded-xl border p-4 bg-gradient-to-br from-blue-50 to-emerald-50 dark:from-blue-950/30 dark:to-emerald-950/30">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Família</p>
              <p className="font-bold text-lg">{family.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{family.members?.length || 0} membro{family.members?.length !== 1 ? 's' : ''}</p>
            </div>

            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Código de convite</p>
                {isOwner && (
                  <Button variant="ghost" size="sm" onClick={regenCode} className="h-7 text-xs gap-1">
                    <RefreshCw className="h-3 w-3" /> Novo
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <div className="flex-1 font-mono font-bold text-xl tracking-widest text-center py-2 bg-muted rounded-md">
                  {family.invite_code}
                </div>
                <Button variant="outline" onClick={copyCode} className="gap-2">
                  <Copy className="h-4 w-4" /> Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Envie esse código para os familiares — eles usam para entrar aqui.
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Membros</p>
              <ul className="space-y-2">
                {(family.members || []).map(m => (
                  <li key={m.email} className="flex items-center gap-3 rounded-lg border p-2">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0 overflow-hidden">
                      {m.picture
                        ? <img src={m.picture} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        : (m.name || m.email || '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {m.name || m.email}
                        {family.owner_email === m.email && <span className="text-xs text-blue-600 ml-2">dono</span>}
                        {m.email === currentEmail && <span className="text-xs text-muted-foreground ml-2">(você)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    {isOwner && m.email !== currentEmail && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMember(m.email)}
                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t">
              <Button variant="destructive" onClick={leaveFamily} className="w-full gap-2">
                <LogOut className="h-4 w-4" /> Sair da família
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Create */}
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold">Criar uma nova família</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Você vira o dono. Seus {' '}
                <b>medicamentos atuais</b> serão migrados para a família.
              </p>
              <div className="flex flex-col gap-2">
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Nome (ex: Família Silva)"
                />
                <Button onClick={createFamily} disabled={creating} className="gap-2">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Criar família
                </Button>
              </div>
            </div>

            <div className="text-center text-xs text-muted-foreground">— OU —</div>

            {/* Join */}
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold">Entrar em uma família</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Peça o código de 10 caracteres para alguém que já criou uma família.
              </p>
              <div className="flex gap-2">
                <Input
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="ABC123DEF4"
                  className="font-mono tracking-widest uppercase"
                  onKeyDown={e => e.key === 'Enter' && joinFamily()}
                />
                <Button onClick={joinFamily} disabled={joining || !inviteCode.trim()} className="gap-2 shrink-0">
                  {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Entrar
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}


/* ============ ACCOUNT MANAGEMENT DIALOG ============ */
function AccountDialog({ open, onOpenChange, user, onGone }) {
  const [mode, setMode] = useState('menu') // 'menu' | 'deactivate' | 'delete'
  const [confirmEmail, setConfirmEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const deactivate = async () => {
    if (!confirm('Deseja mesmo desativar sua conta? Você poderá reativá-la ao fazer login novamente.')) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/deactivate', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro')
      toast.success(data.message || 'Conta desativada')
      onOpenChange(false)
      onGone()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteAccount = async () => {
    if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      toast.error('Digite exatamente seu email para confirmar')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm_email: confirmEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro')
      toast.success(data.message || 'Conta excluída')
      onOpenChange(false)
      onGone()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const close = () => { setMode('menu'); setConfirmEmail(''); onOpenChange(false) }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
            <span>Gerenciar conta</span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            Você está logado como <b>{user.email}</b>.
          </DialogDescription>
        </DialogHeader>

        {mode === 'menu' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('deactivate')}
              className="w-full text-left rounded-xl border p-4 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950 shrink-0">
                  <Moon className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">Desativar conta</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sua conta e dados ficam guardados. Reative fazendo login de novo.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('delete')}
              className="w-full text-left rounded-xl border border-red-200 dark:border-red-900 p-4 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950 shrink-0">
                  <Trash2 className="h-4 w-4 text-red-700 dark:text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-red-700 dark:text-red-400">Excluir conta permanentemente</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Remove sua conta, medicamentos, histórico e sessões. <b>Não pode ser desfeito.</b>
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {mode === 'deactivate' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm">
              <p className="font-medium mb-1">O que acontece ao desativar:</p>
              <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                <li>Você é deslogado imediatamente</li>
                <li>Suas sessões em todos os dispositivos são invalidadas</li>
                <li>Seus medicamentos e histórico <b>ficam guardados</b></li>
                <li>Para reativar, faça login novamente com o mesmo email</li>
              </ul>
            </div>
            <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
              <Button variant="ghost" onClick={() => setMode('menu')}>Voltar</Button>
              <Button onClick={deactivate} disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Moon className="h-4 w-4" />}
                Desativar conta
              </Button>
            </DialogFooter>
          </div>
        )}

        {mode === 'delete' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 text-sm">
              <p className="font-medium text-red-700 dark:text-red-400 mb-1">⚠️ Ação irreversível</p>
              <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                <li>Todos os seus medicamentos serão apagados</li>
                <li>Todo o histórico será apagado</li>
                <li>Se você é dono de uma família, ela será deletada ou passará para outro membro</li>
                <li>Você será removido de qualquer família compartilhada</li>
                <li>Assinaturas de notificação push serão removidas</li>
                <li><b>Não pode ser desfeito.</b> Para começar de novo, terá que cadastrar tudo.</li>
              </ul>
            </div>
            <div>
              <Label className="text-xs">Digite seu email <b className="font-mono">{user.email}</b> para confirmar:</Label>
              <Input
                value={confirmEmail}
                onChange={e => setConfirmEmail(e.target.value)}
                placeholder={user.email}
                autoComplete="off"
                className="mt-1"
              />
            </div>
            <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
              <Button variant="ghost" onClick={() => setMode('menu')}>Voltar</Button>
              <Button
                onClick={deleteAccount}
                disabled={loading || confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()}
                variant="destructive"
                className="gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir conta permanentemente
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}


function AIAssistantSheet({ open, onOpenChange }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Olá! Sou seu assistente HomeMed. Pergunte coisas como: "Tenho algum antialérgico em casa?" ou "Qual remédio tenho para dor de cabeça?"' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const send = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages(m => [...m, { role: 'user', text: q }])
    setLoading(true)
    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro')
      setMessages(m => [...m, { role: 'assistant', text: data.answer }])
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', text: 'Erro: ' + e.message }])
    } finally {
      setLoading(false)
    }
  }

  const suggestions = [
    'Tenho algum antialérgico?',
    'O que serve para dor?',
    'Algum remédio vencendo em breve?',
    'Preciso de receita para algum?',
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full !max-w-full sm:!max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 sm:p-6 pb-4 border-b pr-12">
          <SheetTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="truncate">Assistente HomeMed</span>
          </SheetTitle>
        </SheetHeader>

        {/* Disclaimer */}
        <div className="mx-4 mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex gap-2 text-xs text-amber-900 dark:text-amber-200">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <p className="leading-relaxed">
            Esta é apenas uma consulta aos seus medicamentos cadastrados. Caso os sintomas persistam, um médico deverá ser consultado.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-muted rounded-bl-sm'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>

        {messages.length === 1 && (
          <div className="px-4 pb-2 flex gap-2 flex-wrap">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="text-xs rounded-full border px-3 py-1.5 hover:bg-accent transition"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="p-4 border-t flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Pergunte algo..."
            disabled={loading}
          />
          <Button onClick={send} disabled={loading || !input.trim()} size="icon" className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default App
