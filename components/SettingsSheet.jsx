'use client'

import { useEffect, useState } from 'react'
import {
  Settings, RefreshCw, Compass, BellRing, Bell, Check, Pill, Clock, CalendarClock, AlertTriangle, Loader2, ShieldCheck, Info, Type,
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DAY_OPTIONS, HOUR_MIN, HOUR_MAX } from '@/lib/notification-prefs'
import { TEXT_SIZES, getTextSize, saveTextSize } from '@/lib/text-size'

const HOURS = Array.from({ length: HOUR_MAX - HOUR_MIN + 1 }, (_, i) => HOUR_MIN + i)
const pad = (n) => String(n).padStart(2, '0')

const SAMPLE = {
  title: 'Medicamento perto de vencer',
  body: 'Dipirona 500mg vence em 7 dias.',
}

// "agora mesmo", "há 3 min", "há 2 h"
function ago(ts, now) {
  if (!ts) return null
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 45) return 'agora mesmo'
  const m = Math.round(s / 60)
  if (m < 60) return `há ${m} min`
  return `há ${Math.round(m / 60)} h`
}

function IconTile({ children, className = '' }) {
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${className}`}>
      {children}
    </div>
  )
}

// A little mock of the Android notification, so people see what to expect.
function NotificationPreview({ title, body, hour }) {
  return (
    <div className="rounded-2xl border bg-muted/60 p-3 flex gap-3" aria-hidden>
      <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
        <Pill className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
      </div>
      <div className="min-w-0 text-sm">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground leading-none mb-1">
          <span className="font-medium">HomeMed AI</span>
          <span>•</span>
          <span>{pad(hour)}:00</span>
        </div>
        <p className="font-semibold leading-snug">{title}</p>
        <p className="text-muted-foreground leading-snug break-words">{body}</p>
      </div>
    </div>
  )
}

export default function SettingsSheet({
  open,
  onOpenChange,
  prefs,
  onChange,
  permission, // 'granted' | 'denied' | 'prompt' | 'unsupported'
  onRequestPermission,
  onSendTest,
  nextReminder, // { when, title, body } | null
  native, // true inside the Android app
  lastSync, // timestamp (ms) of the last successful sync, or null
  syncing,
  onSync,
  onStartTour,
  needsUpdate, // Android app too old to have notifications
}) {
  const [testing, setTesting] = useState(false)
  const [textSize, setTextSize] = useState('normal')
  useEffect(() => { if (open) setTextSize(getTextSize()) }, [open])
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!open) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(t)
  }, [open, lastSync])

  const toggleDay = (value) => {
    const has = prefs.days_before.includes(value)
    onChange({ days_before: has ? prefs.days_before.filter(d => d !== value) : [...prefs.days_before, value] })
  }

  const runTest = async () => {
    setTesting(true)
    try { await onSendTest() } finally { setTimeout(() => setTesting(false), 1500) }
  }

  const preview = nextReminder ? { title: nextReminder.title, body: nextReminder.body } : SAMPLE
  const noneChosen = prefs.enabled && prefs.days_before.length === 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full !max-w-full sm:!max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 sm:p-6 pb-4 border-b pr-12 text-left space-y-1">
          <SheetTitle className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-md">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <span className="truncate text-xl">Configurações</span>
          </SheetTitle>
          <SheetDescription>Deixe o HomeMed AI do seu jeito.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-[calc(1.5rem+var(--safe-area-inset-bottom,0px))]">
          {/* ───────── Expiry reminders ───────── */}
          <section className="rounded-2xl border bg-card p-4 space-y-4 shadow-sm">
            <div className="flex items-start gap-3">
              <IconTile className="bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <BellRing className="h-5 w-5" />
              </IconTile>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold leading-tight">Avisos de vencimento</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Receba um lembrete no celular antes de um remédio vencer.
                </p>
              </div>
              <Switch
                checked={prefs.enabled}
                onCheckedChange={(v) => onChange({ enabled: v })}
                aria-label="Ativar avisos de vencimento"
                className="mt-1"
              />
            </div>

            {prefs.enabled && (
              <div className="space-y-5 animate-fade-in">
                {/* When */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" /> Quando avisar
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DAY_OPTIONS.map(opt => {
                      const on = prefs.days_before.includes(opt.value)
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleDay(opt.value)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition active:scale-95 ${
                            on
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'bg-background hover:bg-muted text-foreground'
                          }`}
                        >
                          {on && <Check className="h-3.5 w-3.5" />}
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                  {noneChosen && (
                    <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Escolha pelo menos um momento para receber os avisos.
                    </p>
                  )}
                </div>

                {/* Time */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4 text-muted-foreground" /> Horário do aviso
                  </div>
                  <Select value={String(prefs.hour)} onValueChange={(v) => onChange({ hour: Number(v) })}>
                    <SelectTrigger className="h-11" aria-label="Horário do aviso">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map(h => (
                        <SelectItem key={h} value={String(h)}>{pad(h)}:00</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Se mais de um remédio estiver na mira no mesmo dia, você recebe tudo junto, numa única notificação.
                  </p>
                </div>

                {/* Next reminder */}
                {!noneChosen && (
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 px-3.5 py-3 text-sm">
                    {nextReminder ? (
                      <>
                        <div className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">Próximo aviso</div>
                        <div className="mt-0.5 first-letter:uppercase">{nextReminder.when}</div>
                      </>
                    ) : (
                      <p className="text-blue-900 dark:text-blue-200">
                        Nenhum aviso programado por enquanto. Quando houver remédios perto de vencer, o próximo aparece aqui.
                      </p>
                    )}
                  </div>
                )}

                {/* Preview */}
                {!noneChosen && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Assim vai aparecer no seu celular</div>
                    <NotificationPreview title={preview.title} body={preview.body} hour={prefs.hour} />
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ───────── Text size ───────── */}
          <section className="rounded-2xl border bg-card p-4 space-y-3 shadow-sm">
            <div className="flex items-start gap-3">
              <IconTile className="bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
                <Type className="h-5 w-5" />
              </IconTile>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold leading-tight" id="text-size-title">Tamanho do texto</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Aumente as letras para ler com mais conforto. Vale só neste aparelho.</p>
              </div>
            </div>
            <div role="radiogroup" aria-labelledby="text-size-title" className="grid grid-cols-3 gap-2">
              {TEXT_SIZES.map(s => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={textSize === s.id}
                  onClick={() => setTextSize(saveTextSize(s.id))}
                  className={`rounded-xl border px-2 py-3 text-center font-medium leading-tight transition ${
                    textSize === s.id ? 'border-primary bg-primary/10 ring-2 ring-primary' : 'hover:bg-accent'
                  }`}
                >
                  {textSize === s.id && <Check className="inline h-4 w-4 mr-1 -mt-0.5 text-primary" aria-hidden />}{s.label}
                </button>
              ))}
            </div>
          </section>

          {/* ───────── Low stock ───────── */}
          <section className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <IconTile className="bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </IconTile>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold leading-tight">Aviso de estoque baixo</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Avisa, no mesmo horário dos lembretes ({pad(prefs.hour)}:00), quando um remédio chegar na quantidade mínima.
                </p>
              </div>
              <Switch
                checked={!!prefs.low_stock}
                onCheckedChange={(v) => onChange({ low_stock: v })}
                aria-label="Ativar aviso de estoque baixo"
                className="mt-1"
              />
            </div>
          </section>

          {/* ───────── Sync ───────── */}
          <section className="rounded-2xl border bg-card p-4 space-y-3 shadow-sm">
            <div className="flex items-start gap-3">
              <IconTile className="bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
              </IconTile>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold leading-tight">Sincronizar remédios</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {lastSync ? `Última sincronização: ${ago(lastSync, now)}` : 'Ainda não sincronizado nesta sessão'}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={onSync} disabled={syncing} className="w-full h-11 gap-2">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
            </Button>
            {native && permission === 'granted' && (
              <details className="rounded-xl border bg-muted/40 p-3 text-sm">
                <summary className="cursor-pointer font-medium">Os avisos não chegam com o app fechado?</summary>
                <div className="mt-2 space-y-2 text-muted-foreground leading-relaxed">
                  <p>Alguns celulares (Samsung, Xiaomi, Motorola) suspendem apps que ficam fechados e cancelam os avisos agendados. Para evitar:</p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Abra Configurações → Apps → HomeMed AI → Bateria e escolha <strong>Sem restrições</strong>.</li>
                    <li>No Samsung, vá em Configurações → Bateria → Limites de uso em segundo plano e tire o HomeMed AI de <strong>Apps em suspensão</strong> e <strong>Apps em suspensão profunda</strong>. Desative também "Suspender apps não usados".</li>
                    <li>Abra o HomeMed AI uma vez depois disso, para os avisos serem agendados de novo.</li>
                  </ol>
                </div>
              </details>
            )}

            <div className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Mudanças feitas no site, ou por alguém da família, aparecem aqui sozinhas: quando você abre o app e a cada minuto. Use o botão se quiser ver na hora.
              </p>
            </div>
          </section>

          {/* ───────── Phone permission ───────── */}
          <section className="rounded-2xl border bg-card p-4 space-y-3 shadow-sm">
            <div className="flex items-start gap-3">
              <IconTile className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <Bell className="h-5 w-5" />
              </IconTile>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold leading-tight">Notificações do celular</h3>
                <div className="mt-1 flex items-center gap-2 text-sm">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${
                      permission === 'granted' ? 'bg-emerald-500' : permission === 'denied' ? 'bg-amber-500' : 'bg-slate-400'
                    }`}
                  />
                  <span className="text-muted-foreground">
                    {permission === 'granted' && 'Permitidas'}
                    {permission === 'prompt' && 'Ainda não permitidas'}
                    {permission === 'denied' && 'Bloqueadas'}
                    {permission === 'unsupported' && 'Indisponíveis neste aparelho'}
                  </span>
                </div>
              </div>
            </div>

            {permission === 'prompt' && (
              <Button onClick={onRequestPermission} className="w-full h-11 gap-2">
                <Bell className="h-4 w-4" /> Permitir notificações
              </Button>
            )}

            {permission === 'denied' && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-medium">As notificações estão bloqueadas.</p>
                <p>
                  {native
                    ? 'No Android, abra Configurações → Apps → HomeMed AI → Notificações e ative-as. Depois volte aqui.'
                    : 'Libere as notificações para este site nas configurações do navegador e volte aqui.'}
                </p>
              </div>
            )}

            {permission === 'unsupported' && needsUpdate && (
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 p-3 text-sm text-blue-900 dark:text-blue-200 space-y-1">
                <p className="font-medium">Falta atualizar o app.</p>
                <p>Esta versão do HomeMed AI ainda não tem as notificações. Abra a Google Play, atualize o HomeMed AI e volte aqui.</p>
              </div>
            )}

            {permission === 'unsupported' && !needsUpdate && (
              <p className="text-sm text-muted-foreground">
                Este navegador não suporta notificações. No app para Android elas funcionam normalmente.
              </p>
            )}

            <Button
              variant="outline"
              onClick={runTest}
              disabled={permission !== 'granted' || testing}
              className="w-full h-11 gap-2"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              {testing ? 'Enviando...' : 'Enviar notificação de teste'}
            </Button>

            <div className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                {needsUpdate
                  ? 'Depois de atualizar, os avisos ficam agendados no seu celular e chegam mesmo com o app fechado.'
                  : native
                  ? 'Os avisos ficam agendados no seu celular e chegam mesmo com o app fechado.'
                  : 'No navegador, os avisos aparecem quando você abre o HomeMed AI. No app para Android eles chegam mesmo com o app fechado.'}
              </p>
            </div>
            {native && (
              <div className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                <p>Os nomes dos remédios ficam ocultos na tela de bloqueio, se o seu celular estiver configurado para esconder conteúdo sensível.</p>
              </div>
            )}
          </section>

          {/* ───────── Tour ───────── */}
          <section className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <IconTile className="bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
                <Compass className="h-5 w-5" />
              </IconTile>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold leading-tight">Passeio guiado</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Reveja um tour rápido pelas principais telas do app.</p>
              </div>
            </div>
            <Button variant="outline" onClick={onStartTour} className="w-full h-11 gap-2 mt-3">
              <Compass className="h-4 w-4" /> Rever o passeio
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
