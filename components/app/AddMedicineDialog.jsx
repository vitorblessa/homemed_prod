'use client'

import { useState, useRef } from 'react'
import { useAndroidBack } from '@/lib/useAndroidBack'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Sparkles, Edit2, Loader2, X, Check, ScanLine, Barcode, Camera } from 'lucide-react'
import BarcodeScanner from '@/components/barcode-scanner'
import { emptyForm, MedicineForm } from '@/components/app/MedicineForm'

// Reduces a phone photo (often 4000px+, several MB) to a JPEG the API accepts
// and the AI can still read. Returns a data URL.
export async function shrinkPhoto(file, maxSide = 1600, quality = 0.82) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Não consegui abrir a foto.'))
      i.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const VALID_ISO = /^\d{4}-\d{2}-\d{2}$/

// Turns the AI's photo reading into a form object (see emptyForm).
export function formFromPhoto(d, barcode) {
  return {
    ...emptyForm(d.nome_comercial || ''),
    nome_generico: d.nome_generico || '',
    principio_ativo: d.principio_ativo || '',
    laboratorio: d.laboratorio || d.laboratorio_comum || '',
    concentracao: d.concentracao || '',
    forma_farmaceutica: d.forma_farmaceutica || 'Comprimido',
    categoria: d.categoria || 'Outros',
    classe_terapeutica: d.classe_terapeutica || '',
    para_que_serve: d.para_que_serve || '',
    indicacoes: d.indicacoes || [],
    contraindicacoes: d.contraindicacoes || [],
    efeitos_colaterais: d.efeitos_colaterais || [],
    precisa_receita: !!d.precisa_receita,
    uso_continuo: !!d.uso_continuo_comum,
    modo_armazenamento: d.modo_armazenamento || '',
    lote: d.lote || '',
    data_fabricacao: VALID_ISO.test(d.data_fabricacao || '') ? d.data_fabricacao : '',
    data_validade: VALID_ISO.test(d.data_validade || '') ? d.data_validade : '',
    codigo_barras: barcode || d.codigo_barras || '',
  }
}

/* ============ ADD MEDICINE DIALOG ============ */
export function AddMedicineDialog({ open, onOpenChange, onSaved, editMed, onOpenExisting }) {
  const isEdit = !!editMed
  const [aiInput, setAiInput] = useState('')
  const [enriching, setEnriching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(isEdit ? { ...emptyForm(''), ...editMed } : null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannedCode, setScannedCode] = useState(isEdit ? (editMed.codigo_barras || '') : '')
  const [readingPhoto, setReadingPhoto] = useState(false)
  const photoInputRef = useRef(null)
  const photoMode = useRef('new') // 'new' = start a registration, 'fill' = complete the open form

  // Registered after the dialog's own listener (page mounts this component
  // only while `open` is true), so while the scanner is open it sits on
  // top of the stack and the back button closes it first.
  useAndroidBack(scannerOpen, () => setScannerOpen(false))

  const handleBarcode = (code) => {
    setScannerOpen(false)
    setScannedCode(code)
    toast.success(`Código lido: ${code}`)
    if (form) {
      setForm(f => ({ ...f, codigo_barras: code }))
    }
  }

  const openPhotoPicker = (mode) => {
    photoMode.current = mode
    photoInputRef.current?.click()
  }

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const fillMode = photoMode.current === 'fill' && !!form
    setReadingPhoto(true)
    try {
      // Stamped dates/lot are tiny: keep more resolution for that photo.
      const image_base64 = await shrinkPhoto(file, fillMode ? 2200 : 1600, fillMode ? 0.85 : 0.82)
      const res = await fetch(fillMode ? '/api/ai/read-box-dates' : '/api/ai/enrich-barcode', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fillMode ? { image_base64 } : { barcode: scannedCode || '', image_base64 }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Não consegui ler a foto.')

      if (fillMode) {
        // Only complete what is still empty; never overwrite what the user typed.
        const found = {
          lote: typeof data.lote === 'string' ? data.lote.trim() : '',
          data_fabricacao: VALID_ISO.test(data.data_fabricacao || '') ? data.data_fabricacao : '',
          data_validade: VALID_ISO.test(data.data_validade || '') ? data.data_validade : '',
        }
        const names = { lote: 'lote', data_fabricacao: 'fabricação', data_validade: 'validade' }
        const got = Object.keys(found).filter(k => found[k] && !form[k])
        if (got.length) {
          setForm(f => {
            const next = { ...f }
            for (const k of got) if (!f[k]) next[k] = found[k]
            return next
          })
          toast.success(`Li: ${got.map(k => names[k]).join(', ')}. Confira antes de salvar.`)
        } else {
          toast.error('Não consegui ler validade nem lote nessa foto. Chegue mais perto do carimbo, com boa luz e sem reflexo, ou digite à mão.')
        }
        return
      }

      if (data.reconhecido === false) {
        toast.error('Não consegui reconhecer o remédio nessa foto. Tente de novo com a caixa bem iluminada, ou digite o nome.')
        return
      }
      const fromPhoto = formFromPhoto(data, scannedCode)
      setForm(fromPhoto)
      toast.success(fromPhoto.data_validade
        ? 'Li a caixa! Confira os dados e salve.'
        : 'Reconheci o remédio, mas não li a validade. Use "Ler validade e lote por foto" e fotografe de perto o carimbo (lateral ou aba da caixa).')
    } catch (err) {
      toast.error(err.message || 'Não consegui ler a foto.')
    } finally {
      setReadingPhoto(false)
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

            <Button
              onClick={() => openPhotoPicker('new')}
              disabled={readingPhoto}
              className="w-full h-12 gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
            >
              {readingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {readingPhoto ? 'Lendo a caixa...' : 'Fotografar a caixa'}
            </Button>
            <p className="-mt-2 text-xs text-muted-foreground text-center">
              A IA lê nome, validade e lote direto da embalagem. Mostre bem a parte com a validade.
            </p>

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
          <div className="space-y-3">
            {(!form.data_validade || !form.lote) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => openPhotoPicker('fill')}
                disabled={readingPhoto}
                className="w-full h-11 gap-2 border-dashed"
              >
                {readingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {readingPhoto ? 'Lendo a foto...' : 'Ler validade e lote por foto'}
              </Button>
            )}
            <MedicineForm form={form} setForm={setForm} onScan={() => setScannerOpen(true)} />
          </div>
        )}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhoto}
          data-testid="box-photo-input"
        />

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
