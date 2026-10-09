'use client'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { Pill, Package, Moon, Sun, ShieldAlert, Info, Download, FileText, FileSpreadsheet, File, LogOut, Users, Settings } from 'lucide-react'
import { DOSE_REMINDERS_ENABLED, normalizeDoseTimes } from '@/lib/doses'
import { exportToPDF, exportToExcel, exportToCSV } from '@/lib/export'

export function AppHeader({ theme, doLogout, medicines, setAccountOpen, setDosesOpen, setFamilyOpen, setSettingsOpen, setTravelOpen, toggleTheme, user }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shrink-0">
            <Pill className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-lg tracking-tight leading-none">HomeMed AI</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-wider truncate">{user.name || user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" title="Exportar" data-tour="export">
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={18} className="w-52">
              <DropdownMenuLabel>Exportar farmácia</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  if (medicines.length === 0) { toast.error('Nenhum medicamento para exportar'); return }
                  exportToPDF(medicines)
                }}
              >
                <FileText className="h-4 w-4 mr-2 text-red-600" />
                PDF (relatório)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (medicines.length === 0) { toast.error('Nenhum medicamento para exportar'); return }
                  exportToExcel(medicines)
                }}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (medicines.length === 0) { toast.error('Nenhum medicamento para exportar'); return }
                  exportToCSV(medicines)
                }}
              >
                <File className="h-4 w-4 mr-2 text-blue-600" />
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTravelOpen(true)}>
                <Package className="h-4 w-4 mr-2 text-emerald-600" />
                Lista de viagem
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {DOSE_REMINDERS_ENABLED && medicines.some(m => normalizeDoseTimes(m.dose_times).length > 0) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDosesOpen(true)}
              className="rounded-full"
              aria-label="Doses de hoje"
            >
              <Pill className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            data-tour="settings"
            onClick={() => setSettingsOpen(true)}
            className="rounded-full"
            aria-label="Configurações"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleTheme()}
            className="rounded-full"
            aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button data-tour="profile" className="rounded-full ring-1 ring-border hover:ring-primary/50 transition overflow-hidden shrink-0" aria-label="Perfil">
                {user.picture ? (
                  <img src={user.picture} alt="" className="w-8 h-8 object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center font-semibold text-xs">
                    {(user.name || user.email || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={18} className="w-56">
              <DropdownMenuLabel>
                <div className="text-sm font-medium truncate">{user.name}</div>
                <div className="text-xs text-muted-foreground truncate font-normal">{user.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFamilyOpen(true)}>
                <Users className="h-4 w-4 mr-2 text-blue-600" /> Compartilhamento familiar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                <Settings className="h-4 w-4 mr-2 text-slate-600" /> Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAccountOpen(true)}>
                <ShieldAlert className="h-4 w-4 mr-2 text-amber-600" /> Gerenciar conta
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/privacy" target="_blank" rel="noopener noreferrer">
                  <Info className="h-4 w-4 mr-2 text-slate-500" /> Política de Privacidade
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/terms" target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4 mr-2 text-slate-500" /> Termos de Uso
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={doLogout} className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400">
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
