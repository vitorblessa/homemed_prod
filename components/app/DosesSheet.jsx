'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from 'sonner'
import { Pill, Plus, Loader2, X, Check } from 'lucide-react'
import { MAX_DOSE_TIMES, dosesForDay, normalizeDoseTimes } from '@/lib/doses'

/* ============ DOSE REMINDERS ============ */
export function localDateStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function DoseTimesField({ value, onChange }) {
  const times = normalizeDoseTimes(value)
  const [draft, setDraft] = useState('08:00')
  const add = () => {
    if (!draft || times.includes(draft)) return
    onChange(normalizeDoseTimes([...times, draft]))
  }
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div>
        <p className="text-sm font-medium">Lembrete de horário</p>
        <p className="text-xs text-muted-foreground">
          Só um lembrete para você se organizar, todo dia nesses horários. Siga sempre a receita do seu médico.
        </p>
      </div>
      {times.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {times.map(t => (
            <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-sm">
              {t}
              <button type="button" aria-label={`Remover ${t}`} onClick={() => onChange(times.filter(x => x !== t))}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      {times.length < MAX_DOSE_TIMES && (
        <div className="flex gap-2">
          <Input type="time" value={draft} onChange={e => setDraft(e.target.value)} className="h-10 w-32" aria-label="Novo horário" />
          <Button type="button" variant="outline" onClick={add} className="h-10 gap-1">
            <Plus className="h-4 w-4" /> Adicionar horário
          </Button>
        </div>
      )}
    </div>
  )
}

export function DosesSheet({ open, onOpenChange, medicines, onChanged }) {
  const [taken, setTaken] = useState(new Set()) // "medicineId@HH:MM"
  const [busy, setBusy] = useState(null)
  const date = localDateStr()
  const doses = dosesForDay(medicines)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch(`/api/doses?date=${date}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : { taken: [] }))
      .then(d => { if (!cancelled) setTaken(new Set((d.taken || []).map(t => `${t.medicine_id}@${t.time}`))) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [open, date])

  const take = async (d) => {
    setBusy(d.key)
    try {
      const res = await fetch(`/api/medicines/${d.id}/take`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, time: d.time }),
      })
      if (!res.ok) throw new Error()
      setTaken(prev => new Set(prev).add(d.key))
      onChanged?.()
    } catch {
      toast.error('Não consegui registrar. Tente de novo.')
    } finally {
      setBusy(null)
    }
  }

  const nowHm = new Date().toTimeString().slice(0, 5)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full !max-w-full sm:!max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 sm:p-6 pb-4 border-b pr-12 text-left">
          <SheetTitle className="flex items-center gap-2.5 text-xl">
            <Pill className="h-5 w-5 text-blue-600" /> Doses de hoje
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-[calc(1.5rem+var(--safe-area-inset-bottom,0px))]">
          {doses.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum horário cadastrado. Edite um remédio e adicione "Lembrete de horário".</p>
          )}
          {doses.map(d => {
            const done = taken.has(d.key)
            const late = !done && d.time < nowHm
            return (
              <div key={d.key} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <div className={`text-lg font-semibold tabular-nums ${late ? 'text-amber-600' : ''}`}>{d.time}</div>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium truncate">{d.name}</div>
                  {late && <div className="text-xs text-amber-600">Horário passou</div>}
                </div>
                {done ? (
                  <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><Check className="h-4 w-4" /> Tomei</span>
                ) : (
                  <Button size="sm" onClick={() => take(d)} disabled={busy === d.key} className="h-9">
                    {busy === d.key ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tomei'}
                  </Button>
                )}
              </div>
            )
          })}
          {doses.length > 0 && (
            <p className="pt-2 text-xs text-muted-foreground">
              Ao marcar "Tomei", o app desconta 1 unidade do estoque. Este recurso é só um lembrete e não substitui a orientação do seu médico.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
