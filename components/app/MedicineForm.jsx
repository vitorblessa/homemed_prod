'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Info, ScanLine } from 'lucide-react'
import { DOSE_REMINDERS_ENABLED } from '@/lib/doses'
import { CATEGORIA_COLORS, FORMAS } from '@/components/app/constants'
import { DoseTimesField } from '@/components/app/DosesSheet'

export function emptyForm(name) {
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
    dose_times: [],
  }
}

export function MedicineForm({ form, setForm, onScan }) {
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

      {DOSE_REMINDERS_ENABLED && <DoseTimesField value={form.dose_times} onChange={v => upd('dose_times', v)} />}

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

export function Field({ label, children, full }) {
  return (
    <div className={full ? 'sm:col-span-2 space-y-1' : 'space-y-1'}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
