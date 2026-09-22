'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Toaster, toast } from 'sonner'
import { Trash2, ShieldAlert, Loader2, Check, Pill } from 'lucide-react'

export default function DeleteAccountPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async () => {
    if (!email.includes('@')) return toast.error('Informe um e-mail válido')
    if (!password) return toast.error('Informe a senha')
    if (confirmEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
      return toast.error('Digite exatamente seu e-mail para confirmar')
    }
    setLoading(true)
    try {
      // 1. Login to prove ownership
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      const loginData = await loginRes.json()
      if (!loginRes.ok) throw new Error(loginData?.error || 'Login falhou. Se você usa Google, entre no app e exclua por lá.')

      // 2. Delete account
      const delRes = await fetch('/api/auth/account', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm_email: email.trim().toLowerCase() }),
      })
      const delData = await delRes.json()
      if (!delRes.ok) throw new Error(delData?.error || 'Erro ao excluir')
      setDone(true)
      toast.success('Sua conta foi excluída permanentemente.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-red-950/30 py-8 px-4 flex items-center justify-center">
      <Toaster position="top-center" richColors />
      <Card className="w-full max-w-lg border-0 shadow-xl">
        <CardContent className="p-6 sm:p-10 space-y-5">
          <header className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950 flex items-center justify-center">
              <ShieldAlert className="h-7 w-7 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Excluir minha conta HomeMed</h1>
              <p className="text-sm text-muted-foreground mt-1">Página pública para solicitar exclusão permanente da sua conta.</p>
            </div>
          </header>

          {done ? (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-5 text-center">
              <Check className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
              <p className="font-semibold">Conta excluída com sucesso</p>
              <p className="text-xs text-muted-foreground mt-2">Seus dados foram removidos definitivamente. Se você mudar de ideia, será necessário criar uma nova conta.</p>
              <a href="/" className="inline-block mt-4 text-sm text-blue-600 underline">Voltar</a>
            </div>
          ) : (
            <>
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-4 text-sm">
                <p className="font-medium text-red-700 dark:text-red-400 mb-1">O que será removido permanentemente:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs text-muted-foreground">
                  <li>Seus medicamentos e histórico</li>
                  <li>Preferencias e assinaturas de notificação</li>
                  <li>Todas as sessões de login</li>
                  <li>Se você for dono de uma família sozinho, ela será excluída. Se há outros membros, a propriedade será transferida antes de sair.</li>
                </ul>
                <p className="text-xs mt-2"><b>Prazo</b>: exclusão imediata na base ativa. Backups podem retê-los por até 30 dias por segurança antes de expiração.</p>
                <p className="text-xs mt-2">Dados que possamos ser obrigados a reter por lei (logs de segurança, por exemplo) permanecerão pelo prazo legal aplicável.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs">E-mail da conta</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" />
                </div>
                <div>
                  <Label className="text-xs">Senha</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" autoComplete="current-password" />
                  <p className="text-[11px] text-muted-foreground mt-1">A senha é exigida para provar que você é o dono da conta. Contas Google devem usar a opção &ldquo;Gerenciar conta&rdquo; dentro do app.</p>
                </div>
                <div>
                  <Label className="text-xs">Digite novamente seu e-mail para confirmar</Label>
                  <Input value={confirmEmail} onChange={e => setConfirmEmail(e.target.value)} placeholder={email || 'seu@email.com'} />
                </div>
                <Button
                  onClick={submit}
                  disabled={loading || !email || !password || confirmEmail.trim().toLowerCase() !== email.trim().toLowerCase()}
                  variant="destructive"
                  className="w-full gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Excluir minha conta permanentemente
                </Button>
              </div>

              <div className="text-center text-xs text-muted-foreground pt-3 border-t">
                <p>Precisa de ajuda? <a href="mailto:suporte@homemed.app" className="text-blue-600 underline">suporte@homemed.app</a></p>
                <div className="mt-2 flex justify-center gap-3">
                  <a href="/" className="text-blue-600 underline flex items-center gap-1"><Pill className="h-3 w-3" /> Voltar</a>
                  <a href="/privacy" className="text-blue-600 underline">Privacidade</a>
                  <a href="/terms" className="text-blue-600 underline">Termos</a>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
