'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from 'sonner'
import { Sparkles, AlertTriangle, Trash2, Edit2, MapPin, Loader2, ChevronRight, Check, Info, RefreshCw } from 'lucide-react'
import { ExpiryBadge, CategoryBadge } from '@/components/app/ui-bits'

/* ============ MEDICINE DETAIL SHEET ============ */
export const COLLECTION_SEARCH_URL =
  'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent('farmácia ponto de coleta de medicamentos vencidos')

// Disposal guidance for expired / unwanted medicines (Brazil: Decreto 10.388/2020,
// reverse logistics: pharmacies and drugstores receive them). The map search
// uses the phone's own location, so the app needs no location permission.
export function DiscardGuide({ med }) {
  const expired = med.expiry_status === 'expired'
  return (
    <Section title="Descarte" color={expired ? 'text-red-700 dark:text-red-400' : undefined}>
      <details open={expired} className="rounded-xl border bg-card p-3 text-sm group">
        <summary className="cursor-pointer font-medium list-none flex items-center justify-between gap-2">
          <span>{expired ? 'Vencido: como descartar com segurança' : 'Como descartar um remédio'}</span>
          <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
        </summary>
        <div className="mt-3 space-y-3">
          <div>
            <p className="font-medium text-red-700 dark:text-red-400">Não jogue</p>
            <p className="text-muted-foreground">No lixo comum, na pia ou no vaso sanitário. Isso contamina a água e o solo e pode causar acidentes.</p>
          </div>
          <div>
            <p className="font-medium">Leve a um ponto de coleta</p>
            <p className="text-muted-foreground">
              Muitas farmácias e drogarias recebem medicamentos vencidos ou que sobraram. Algumas prefeituras e unidades de saúde também recebem. Nem todo estabelecimento participa: confirme antes de ir.
            </p>
          </div>
          <div>
            <p className="font-medium">Até levar</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>Guarde na embalagem original, fechado e longe de crianças e animais.</li>
              <li>Líquidos: mantenha o frasco bem fechado, não derrame.</li>
              <li>Seringas e agulhas têm regra própria: pergunte na unidade de saúde ou no serviço municipal.</li>
              <li>Controlados: consulte o ponto de coleta antes de levar.</li>
            </ul>
          </div>
          <Button asChild variant="outline" className="w-full h-11 gap-2">
            <a href={COLLECTION_SEARCH_URL} target="_blank" rel="noopener noreferrer">
              <MapPin className="h-4 w-4" /> Buscar pontos de coleta perto de mim
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            A busca abre o mapa do seu celular. Confira no local se o estabelecimento recebe. Regra geral: Decreto federal nº 10.388/2020 (logística reversa de medicamentos).
          </p>
        </div>
      </details>
    </Section>
  )
}

export function LeafletSummary({ med }) {
  const [data, setData] = useState(med.bula_resumo || null)
  const [loading, setLoading] = useState(false)
  useEffect(() => { setData(med.bula_resumo || null) }, [med.id, med.bula_resumo])

  const generate = async (refresh = false) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/medicines/${med.id}/leaflet`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error || 'Não consegui gerar o resumo.')
      setData(d.bula_resumo)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const List = ({ title, items, color }) => items?.length ? (
    <div>
      <p className={`text-sm font-medium ${color || ''}`}>{title}</p>
      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5 mt-0.5">
        {items.map((t, i) => <li key={i} className="break-anywhere">{t}</li>)}
      </ul>
    </div>
  ) : null

  return (
    <Section title="Resumo da bula">
      {!data ? (
        <Button variant="outline" onClick={() => generate(false)} disabled={loading} className="w-full h-11 gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Gerando...' : 'Explicar em linguagem simples'}
        </Button>
      ) : (
        <div className="rounded-xl border bg-card p-3 space-y-3">
          <p className="text-sm break-anywhere">{data.resumo}</p>
          <List title="Antes de usar" items={data.antes_de_usar} />
          <List title="Evite misturar com" items={data.evite_misturar} />
          <List title="Procure ajuda se" items={data.procure_ajuda_se} color="text-red-700 dark:text-red-400" />
          {data.se_esquecer_uma_dose && (
            <div>
              <p className="text-sm font-medium">Se esquecer uma dose</p>
              <p className="text-sm text-muted-foreground">{data.se_esquecer_uma_dose}</p>
            </div>
          )}
          {data.como_guardar && (
            <div>
              <p className="text-sm font-medium">Como guardar</p>
              <p className="text-sm text-muted-foreground">{data.como_guardar}</p>
            </div>
          )}
          <div className="flex gap-2 text-xs text-muted-foreground border-t pt-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Resumo feito por IA, pode ter erros. Não traz doses e não substitui a bula nem a orientação do seu médico ou farmacêutico.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => generate(true)} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Gerar de novo
          </Button>
        </div>
      )}
    </Section>
  )
}

export function MedicineDetailSheet({ med, onClose, onDelete, onQty, onEdit }) {
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
            <Button variant="outline" onClick={onDelete} className="gap-2 w-full text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 border-red-200 dark:border-red-900">
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
                    <Info className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <span className="break-anywhere flex-1 min-w-0">{i}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <LeafletSummary med={med} />

          <DiscardGuide med={med} />

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

export function InfoRow({ label, value, mono, full }) {
  if (!value) return null
  return (
    <div className={`min-w-0 ${full ? 'col-span-2' : ''}`}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-medium break-anywhere ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  )
}

export function Section({ title, children, color }) {
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${color || 'text-muted-foreground'}`}>{title}</p>
      {children}
    </div>
  )
}
