'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Pill, Sparkles, CalendarClock, Package, Check, ScanLine, Bell, Users, RefreshCw, Smartphone, Globe } from 'lucide-react'

export const LANDING_FEATURES = [
  { icon: Sparkles, title: 'Cadastro com IA', text: 'Digite o nome do remédio ou escaneie a caixa e a IA preenche princípio ativo, para que serve, contraindicações e mais.' },
  { icon: CalendarClock, title: 'Controle de validade', text: 'Veja de relance o que está vencendo ou já venceu, com alertas antes que seja tarde.' },
  { icon: Package, title: 'Estoque da casa toda', text: 'Organize por categoria e local de armazenamento, com controle de quantidade e estoque mínimo.' },
  { icon: Users, title: 'Compartilhamento em família', text: 'Convide as pessoas da sua casa para ver e atualizar o mesmo inventário.' },
  { icon: Bell, title: 'Alertas automáticos', text: 'Notificações quando um medicamento está prestes a vencer.' },
  { icon: ScanLine, title: 'Leitor de código de barras', text: 'Escaneie a embalagem para identificar o produto na hora.' },
]

export function LandingScreen({ onGetStarted }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16 space-y-10">
        {/* Hero */}
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg">
            <Pill className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">HomeMed AI</h1>
            <p className="text-base text-muted-foreground mt-2 max-w-md mx-auto">
              A farmácia da sua casa, organizada. Controle validade, estoque e localização
              dos medicamentos da família com ajuda de inteligência artificial.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto pt-2">
            <Button onClick={() => onGetStarted('register')} className="h-11 px-8 gap-2">
              <Check className="h-4 w-4" /> Criar conta grátis
            </Button>
            <Button onClick={() => onGetStarted('login')} variant="outline" className="h-11 px-8">
              Já tenho conta
            </Button>
          </div>
        </div>

        {/* Site + app */}
        <div className="rounded-2xl border bg-white/70 dark:bg-slate-900/60 backdrop-blur p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-center gap-3 text-blue-600 dark:text-blue-400">
            <Globe className="h-6 w-6" />
            <RefreshCw className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <Smartphone className="h-6 w-6" />
          </div>
          <h2 className="text-center font-semibold mt-3">Site e app, sempre em sincronia</h2>
          <p className="text-sm text-muted-foreground text-center mt-1.5 max-w-md mx-auto leading-relaxed">
            Sua conta funciona no site e no app Android. O que você cadastra em um aparece no outro
            automaticamente, e você pode sincronizar na hora em <strong className="font-medium text-foreground">Configurações</strong>.
          </p>
        </div>

        {/* Features */}
        <div className="grid gap-4 sm:grid-cols-2">
          {LANDING_FEATURES.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="border-0 shadow-sm">
              <CardContent className="p-4 flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{text}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center space-y-2 pt-4">
          <p className="text-xs text-muted-foreground">
            Seus medicamentos ficam privados e associados apenas à sua conta.
          </p>
          <p className="text-xs text-muted-foreground">
            <a href="/privacy" className="underline hover:text-foreground">Política de Privacidade</a>
            {' · '}
            <a href="/terms" className="underline hover:text-foreground">Termos de Uso</a>
          </p>
        </div>
      </div>
    </main>
  )
}
