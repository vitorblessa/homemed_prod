'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

// A small spotlight tour with no dependencies. Each step either points at an
// element (`target` = value of its data-tour attribute) or is centred.
// Steps whose target isn't on screen are skipped.
export const TOUR_STEPS = [
  {
    id: 'welcome',
    emoji: '👋',
    title: 'Bem-vindo ao HomeMed AI!',
    text: 'Em menos de um minuto você conhece o essencial. Pode pular quando quiser.',
  },
  {
    id: 'add',
    target: 'add',
    title: 'Cadastre com IA',
    text: 'Tire uma foto da caixa ou escaneie o código de barras. A IA preenche nome, concentração e validade para você.',
  },
  {
    id: 'stats',
    target: 'stats',
    title: 'Seu painel de validades',
    text: 'Veja de relance o que está perto de vencer, o que já venceu e o que está acabando. Toque num cartão para filtrar a lista.',
  },
  {
    id: 'assistant',
    target: 'assistant',
    title: 'Pergunte ao assistente',
    text: 'Tente algo como "tenho algum remédio para febre?". Ele consulta a sua farmácia e responde na hora.',
  },
  {
    id: 'settings',
    target: 'settings',
    title: 'Avisos e sincronização',
    text: 'Ative os avisos de vencimento no celular e sincronize seus remédios entre o site e o app.',
  },
  {
    id: 'profile',
    target: 'profile',
    title: 'Divida com a família',
    text: 'Neste menu você convida a família para compartilhar a mesma farmácia e gerencia a sua conta.',
  },
  {
    id: 'done',
    emoji: '🎉',
    title: 'Tudo pronto!',
    text: 'Comece cadastrando o seu primeiro medicamento. Você pode rever este passeio quando quiser, em Configurações.',
  },
]

const PAD = 6
const GAP = 14

function findTarget(name) {
  if (!name) return null
  const el = document.querySelector(`[data-tour="${name}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? el : null
}

export default function GuidedTour({ open, onFinish }) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null) // target rect in viewport coords, or null for centred steps
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false })
  const cardRef = useRef(null)

  // Only the steps that can be shown right now.
  const [steps, setSteps] = useState(TOUR_STEPS)
  useEffect(() => {
    if (!open) return
    setSteps(TOUR_STEPS.filter(s => !s.target || findTarget(s.target)))
    setIndex(0)
  }, [open])

  const step = steps[index]
  const last = index === steps.length - 1

  const measure = useCallback(() => {
    if (!step) return
    const el = findTarget(step.target)
    setRect(el ? el.getBoundingClientRect() : null)
  }, [step])

  // Bring the target into view, then follow it on scroll / resize.
  useEffect(() => {
    if (!open || !step) return
    const el = findTarget(step.target)
    if (el) {
      const r = el.getBoundingClientRect()
      const fixed = getComputedStyle(el).position === 'fixed'
      if (!fixed && (r.top < 80 || r.bottom > window.innerHeight - 160)) {
        el.scrollIntoView({ block: 'center', behavior: 'auto' })
      }
    }
    measure()
    const t = setTimeout(measure, 120)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, step, measure])

  // Place the card next to the target (below if it fits, otherwise above).
  useLayoutEffect(() => {
    if (!open || !step) return
    const card = cardRef.current
    if (!card) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = card.offsetWidth
    const h = card.offsetHeight
    if (!rect) {
      setPos({ top: Math.max(16, (vh - h) / 2), left: (vw - w) / 2, ready: true })
      return
    }
    const below = rect.bottom + PAD + GAP
    const above = rect.top - PAD - GAP - h
    let top = below + h <= vh - 16 ? below : above >= 16 ? above : Math.max(16, vh - h - 16)
    let left = rect.left + rect.width / 2 - w / 2
    left = Math.min(Math.max(16, left), vw - w - 16)
    setPos({ top, left, ready: true })
  }, [open, step, rect])

  const next = () => (last ? onFinish() : setIndex(i => i + 1))
  const back = () => setIndex(i => Math.max(0, i - 1))

  // Keyboard: Esc skips, arrows move.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onFinish()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!open || !step) return null

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label="Passeio guiado">
      {/* Blocks clicks on the page underneath */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Spotlight: the huge shadow darkens everything but the target */}
      {rect ? (
        <div
          className="absolute rounded-xl ring-2 ring-white/90 pointer-events-none transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.72)',
          }}
        />
      ) : (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(2, 6, 23, 0.72)' }} />
      )}

      {/* Card */}
      <div
        ref={cardRef}
        className="absolute rounded-2xl bg-card text-card-foreground shadow-2xl border p-4 w-[min(340px,calc(100vw-32px))] transition-opacity duration-150"
        style={{ top: pos.top, left: pos.left, opacity: pos.ready ? 1 : 0 }}
      >
        <button
          onClick={onFinish}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-full text-muted-foreground hover:bg-muted"
          aria-label="Pular passeio"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="pr-7">
          <h3 className="font-semibold text-base leading-snug">
            {step.emoji && <span className="mr-1.5">{step.emoji}</span>}
            {step.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{step.text}</p>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-1.5" aria-label={`Passo ${index + 1} de ${steps.length}`}>
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {index === 0 ? (
              <Button variant="ghost" size="sm" onClick={onFinish}>Pular</Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={back} className="gap-1 px-2">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
            )}
            <Button size="sm" onClick={next} className="gap-1">
              {last ? (<><Check className="h-4 w-4" /> Começar</>) : index === 0 ? (<>Vamos lá <ChevronRight className="h-4 w-4" /></>) : (<>Próximo <ChevronRight className="h-4 w-4" /></>)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
