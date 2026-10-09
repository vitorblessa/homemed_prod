'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search, Sparkles, CalendarClock, Boxes, MapPin, Loader2, X, ShieldAlert, TrendingDown, Archive } from 'lucide-react'
import { CategoryBadge, StatCard, CategoryScroller } from '@/components/app/ui-bits'
import { MedicineCard } from '@/components/app/MedicineCard'

export function SearchHero({ search, setAddOpen, setSearch }) {
  return (
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
              placeholder="Buscar remédio, princípio ativo..."
              aria-label="Buscar medicamento"
              className="pl-9 bg-white text-slate-900 border-0 h-11"
            />
          </div>
          <Button
            data-tour="add"
            onClick={() => setAddOpen(true)}
            className="h-11 bg-white text-blue-700 hover:bg-blue-50 font-semibold gap-2 shadow-md"
          >
            <Sparkles className="h-4 w-4" /> Cadastrar com IA
          </Button>
        </div>
      </div>
    </section>
  )
}

export function StatsGrid({ catCount, filterCat, setFilterCat, setStatusFilter, stats, statusFilter }) {
  return (
    <section data-tour="stats" className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
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
  )
}

export function FilterBars({ unlabeledCount, catCount, filterCat, filterLocal, hasLocations, locationCounts, setFilterCat, setFilterLocal, sortedLocations, stats }) {
  return (
    <>
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
    </>
  )
}

export function MedicineList({ filterCat, filterLocal, filteredMedicines, groupedMedicines, loading, medicines, setAddOpen, setDetailMed, setFilterCat, setFilterLocal, setStatusFilter, showGrouped, sortedCategories, statusFilter }) {
  return (
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
                <p className="text-sm text-muted-foreground mt-1 px-12 sm:px-0">Comece cadastrando seu primeiro medicamento com IA.</p>
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
  )
}
