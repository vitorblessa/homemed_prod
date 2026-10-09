'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CalendarClock, ChevronRight, ChevronLeft, Check, ShieldAlert } from 'lucide-react'
import { CATEGORIA_COLORS } from '@/components/app/constants'

export function ExpiryBadge({ status, days }) {
  if (status === 'expired') return <Badge className="bg-red-700 hover:bg-red-700 text-white gap-1"><ShieldAlert className="h-3 w-3"/>Vencido</Badge>
  if (status === 'critical') return <Badge className="bg-red-600 hover:bg-red-600 text-white gap-1"><AlertTriangle className="h-3 w-3"/>{days}d</Badge>
  if (status === 'warning_30') return <Badge className="bg-orange-700 hover:bg-orange-700 text-white gap-1"><CalendarClock className="h-3 w-3"/>{days}d</Badge>
  if (status === 'warning_60') return <Badge className="bg-yellow-400 hover:bg-yellow-400 text-yellow-950 gap-1"><CalendarClock className="h-3 w-3"/>{days}d</Badge>
  if (status === 'warning_90') return <Badge className="bg-blue-600 hover:bg-blue-600 text-white gap-1"><CalendarClock className="h-3 w-3"/>{days}d</Badge>
  if (status === 'ok') return <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-400">{days}d</Badge>
  return <Badge variant="outline">—</Badge>
}

export function CategoryBadge({ cat }) {
  const cls = CATEGORIA_COLORS[cat] || CATEGORIA_COLORS['Outros']
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{cat || 'Outros'}</span>
}

export function StatCard({ icon: Icon, label, value, color, subtitle, onClick, active }) {  return (
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
            <div className="text-xs sm:text-sm text-muted-foreground mt-1 leading-tight">{label}</div>
            {subtitle && <div className="text-xs text-muted-foreground mt-0.5 leading-tight truncate">{subtitle}</div>}
          </div>
        </CardContent>
      </Card>
    </button>
  )
}

/* ============ CATEGORY SCROLLER (with arrows on desktop hover) ============ */
export function CategoryScroller({ children }) {
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
