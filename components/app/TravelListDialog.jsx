'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { AlertTriangle, Package, Send, FileText, Copy } from 'lucide-react'
import { exportTravelPDF } from '@/lib/export'
import { buildTripText, fmtBR, itemLabel, tripIssue } from '@/lib/travel'
import { localDateStr } from '@/components/app/DosesSheet'

/* ============ TRAVEL LIST ============ */
export function TravelListDialog({ open, onOpenChange, medicines }) {
  const today = localDateStr()
  const [destination, setDestination] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState({}) // id -> qty

  const list = medicines
    .filter(m => !q || itemLabel(m).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => itemLabel(a).localeCompare(itemLabel(b), 'pt-BR'))
  const items = medicines
    .filter(m => picked[m.id] != null)
    .map(m => ({ med: m, qty: picked[m.id] }))
    .sort((a, b) => itemLabel(a.med).localeCompare(itemLabel(b.med), 'pt-BR'))
  const issues = items.filter(i => tripIssue(i.med, today, returnDate) === 'before_return')

  const toggle = (m) => setPicked(p => {
    const next = { ...p }
    if (next[m.id] != null) delete next[m.id]
    else next[m.id] = 1
    return next
  })
  const setQty = (m, delta) => setPicked(p => {
    const max = Math.max(1, Number(m.quantidade) || 1)
    return { ...p, [m.id]: Math.min(max, Math.max(1, (p[m.id] || 1) + delta)) }
  })

  const opts = { destination: destination.trim(), returnDate }
  const text = () => buildTripText(items, opts)

  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: 'Farmácia de viagem', text: text() }); return }
    } catch (e) { if (e?.name === 'AbortError') return }
    copy()
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(text()); toast.success('Lista copiada. É só colar numa mensagem.') }
    catch { toast.error('Não consegui copiar. Use o PDF.') }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Package className="h-5 w-5 text-emerald-600 shrink-0" /> Lista de viagem
          </DialogTitle>
          <DialogDescription className="text-sm">Escolha o que levar e gere um PDF ou uma lista para enviar.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-muted-foreground">Destino (opcional)</span>
            <Input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Ex.: Florianópolis" className="h-11" />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-muted-foreground">Data de volta (opcional)</span>
            <Input type="date" min={today} value={returnDate} onChange={e => setReturnDate(e.target.value)} className="h-11" />
          </label>
        </div>
        <p className="-mt-1 text-xs text-muted-foreground">Informando a data de volta, avisamos o que vence antes de você voltar.</p>

        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar remédio" className="h-11" aria-label="Buscar remédio" />

        <div className="space-y-1.5 max-h-[38vh] overflow-y-auto pr-1">
          {list.length === 0 && <p className="text-sm text-muted-foreground py-3">Nenhum remédio encontrado.</p>}
          {list.map(m => {
            const issue = tripIssue(m, today, returnDate)
            const on = picked[m.id] != null
            const expired = issue === 'expired'
            return (
              <div key={m.id} className={`flex items-center gap-3 rounded-lg border p-2.5 ${on ? 'border-primary bg-primary/5' : ''} ${expired ? 'opacity-60' : ''}`}>
                <Checkbox checked={on} disabled={expired} onCheckedChange={() => toggle(m)} aria-label={`Levar ${itemLabel(m)}`} />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium truncate">{itemLabel(m)}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.data_validade ? `Validade ${fmtBR(m.data_validade)}` : 'Sem validade'} · estoque {m.quantidade ?? 0}
                  </div>
                  {expired && <div className="text-xs text-red-600">Vencido: não leve</div>}
                  {on && issue === 'before_return' && <div className="text-xs text-amber-600">Vence antes da sua volta</div>}
                </div>
                {on && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty(m, -1)} aria-label="Menos">−</Button>
                    <span className="w-6 text-center text-sm tabular-nums">{picked[m.id]}</span>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty(m, 1)} aria-label="Mais">+</Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {issues.length > 0 && (
          <div className="flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-2.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{issues.length === 1 ? '1 item vence' : `${issues.length} itens vencem`} antes da data de volta. Considere trocar por outro.</p>
          </div>
        )}

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="outline" disabled={!items.length} onClick={copy} className="gap-2"><Copy className="h-4 w-4" /> Copiar</Button>
          <Button variant="outline" disabled={!items.length} onClick={share} className="gap-2"><Send className="h-4 w-4" /> Compartilhar</Button>
          <Button disabled={!items.length} onClick={() => { exportTravelPDF(items, opts); toast.success('PDF gerado') }} className="gap-2">
            <FileText className="h-4 w-4" /> PDF ({items.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
