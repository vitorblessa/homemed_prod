'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast, Toaster } from 'sonner'
import { Pill, AlertTriangle, Loader2, ChevronLeft, Check, Info, Send } from 'lucide-react'

export function LoginScreen({ onGoogleLogin, onLoggedIn, onBack, initialTab, resetToken, onResetDone }) {
  const [tab, setTab] = useState(initialTab === 'register' ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  // 'auth' = login/register, 'forgot' = ask for the reset email,
  // 'reset' = choose a new password (opened from the emailed ?reset= link)
  const [view, setView] = useState(resetToken ? 'reset' : 'auth')
  const [forgotSent, setForgotSent] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  const submitForgot = async () => {
    if (!email.includes('@')) return toast.error('Informe um email válido')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao enviar o link')
      setForgotSent(true)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const submitReset = async () => {
    if (newPassword.length < 8) return toast.error('Senha deve ter ao menos 8 caracteres')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao redefinir a senha')
      toast.success('Senha redefinida! Entre com a nova senha.')
      setNewPassword('')
      setPassword('')
      setTab('login')
      setView('auth')
      onResetDone?.()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const submit = async () => {
    if (!email.includes('@')) return toast.error('Informe um email válido')
    if (password.length < 8) return toast.error('Senha deve ter ao menos 8 caracteres')
    setLoading(true)
    try {
      const url = tab === 'register' ? '/api/auth/register' : '/api/auth/login'
      const body = tab === 'register' ? { email, password, name } : { email, password }
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao autenticar')
      toast.success(tab === 'register' ? `Bem-vindo, ${data.name || data.email}!` : `Olá, ${data.name || data.email}!`)
      onLoggedIn(data)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-emerald-50 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950">
      <Toaster position="top-center" richColors offset="calc(var(--safe-area-inset-top, 0px) + 12px)" mobileOffset="calc(var(--safe-area-inset-top, 0px) + 12px)" />
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardContent className="p-6 sm:p-8 space-y-5">
          {(onBack || view !== 'auth') && (
            <button
              onClick={view !== 'auth' ? () => { setView('auth'); setForgotSent(false) } : onBack}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground -mb-1"
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
          )}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg">
              <Pill className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">HomeMed AI</h1>
              <p className="text-sm text-muted-foreground mt-1">Sua farmácia doméstica inteligente</p>
            </div>
          </div>

          {view === 'auth' && (<>
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setTab('login')}
              className={`py-2 text-sm font-medium rounded-md transition ${tab === 'login' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
            >
              Entrar
            </button>
            <button
              onClick={() => setTab('register')}
              className={`py-2 text-sm font-medium rounded-md transition ${tab === 'register' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
            >
              Criar conta
            </button>
          </div>

          {/* Form */}
          <div className="space-y-3">
            {tab === 'register' && (
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" />
              </div>
            )}
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
            </div>
            <div>
              <Label className="text-xs">Senha</Label>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] px-3 text-sm text-muted-foreground hover:text-foreground"
                >
                  {showPass ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              {tab === 'login' && (
                <button
                  type="button"
                  onClick={() => { setView('forgot'); setForgotSent(false) }}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Esqueci minha senha
                </button>
              )}
            </div>
            <Button onClick={submit} disabled={loading} className="w-full h-11 gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {tab === 'register' ? 'Criar minha conta' : 'Entrar'}
            </Button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-border"></div>
          </div>

          {/* Google */}
          <Button onClick={onGoogleLogin} className="w-full h-11 gap-3 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 shadow-sm">
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar com Google
          </Button>
          </>)}

          {view === 'forgot' && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-semibold">Esqueci minha senha</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
                </p>
              </div>
              {forgotSent ? (
                <div className="space-y-3 text-sm">
                  <div className="rounded-lg border bg-muted/50 p-4 space-y-1">
                    <p>
                      Se existir uma conta com <strong>{email}</strong>, enviamos um link para redefinir a senha. Ele vale por 1 hora.
                    </p>
                    <p className="text-muted-foreground">O e-mail pode levar alguns minutos para chegar.</p>
                  </div>

                  <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/40 p-4 space-y-2 text-amber-950 dark:text-amber-100">
                    <p className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Não achou o e-mail? Olhe o lixo eletrônico!
                    </p>
                    <p>
                      Ele pode ter caído na pasta de <strong>Spam / Lixo eletrônico</strong> (ou em <strong>Promoções</strong>, no Gmail). Procure um e-mail deste remetente:
                    </p>
                    <p className="rounded-md border border-amber-300 bg-white/70 dark:border-amber-700/60 dark:bg-black/20 px-3 py-2 text-center font-semibold break-words select-all">
                      nao-responda@homemed.tech
                    </p>
                    <p>
                      com o assunto <strong>"Redefinir sua senha do HomeMed AI"</strong>. Então:
                    </p>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Abra o e-mail e marque como <strong>"Não é spam"</strong> (ou mova para a caixa de entrada).</li>
                      <li>
                        Adicione esse endereço aos seus contatos ou marque-o como <strong>remetente confiável</strong>, para os próximos
                        e-mails do HomeMed AI chegarem direto na caixa de entrada.
                      </li>
                      <li>Toque no botão <strong>"Redefinir minha senha"</strong> dentro do e-mail.</li>
                    </ol>
                  </div>

                  <Button variant="outline" className="w-full" onClick={() => { setView('auth'); setForgotSent(false) }}>
                    Voltar ao login
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      autoComplete="email"
                      onKeyDown={e => e.key === 'Enter' && submitForgot()}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground flex gap-2">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      O e-mail vem de <strong className="break-words">nao-responda@homemed.tech</strong> e pode cair no lixo eletrônico (spam). Se não aparecer na caixa de entrada, olhe lá e marque como remetente confiável.
                    </span>
                  </p>
                  <Button onClick={submitForgot} disabled={loading} className="w-full h-11 gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar link
                  </Button>
                </div>
              )}
            </div>
          )}

          {view === 'reset' && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-semibold">Criar nova senha</h2>
                <p className="text-sm text-muted-foreground mt-1">Escolha uma nova senha para a sua conta.</p>
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Nova senha</Label>
                  <div className="relative">
                    <Input
                      type={showPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                      onKeyDown={e => e.key === 'Enter' && submitReset()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] px-3 text-sm text-muted-foreground hover:text-foreground"
                    >
                      {showPass ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                </div>
                <Button onClick={submitReset} disabled={loading} className="w-full h-11 gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Salvar nova senha
                </Button>
              </div>
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            Seus medicamentos ficam privados e associados apenas à sua conta.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
