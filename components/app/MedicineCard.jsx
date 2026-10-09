'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Pill, Package, MapPin } from 'lucide-react'
import { ExpiryBadge, CategoryBadge } from '@/components/app/ui-bits'

/* ============ MEDICINE CARD ============ */
export function MedicineCard({ m, onClick }) {
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
/* ============ PUBLIC LANDING (no login required) ============
   Google Play's pre-launch report flags apps whose home screen requires
   sign-in before showing anything. This screen is what unauthenticated
   visitors see: information about what HomeMed AI does, with clear buttons
   to create an account or log in — never a forced auth wall. */
