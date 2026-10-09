'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Trash2, Moon, Loader2, ShieldAlert } from 'lucide-react'

/* ============ ACCOUNT MANAGEMENT DIALOG ============ */
export function AccountDialog({ open, onOpenChange, user, onGone }) {
  const [mode, setMode] = useState('menu') // 'menu' | 'deactivate' | 'delete'
  const [confirmEmail, setConfirmEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const deactivate = async () => {
    if (!confirm('Deseja mesmo desativar sua conta? Você poderá reativá-la ao fazer login novamente.')) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/deactivate', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro')
      toast.success(data.message || 'Conta desativada')
      onOpenChange(false)
      onGone()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteAccount = async () => {
    if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      toast.error('Digite exatamente seu email para confirmar')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm_email: confirmEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro')
      toast.success(data.message || 'Conta excluída')
      onOpenChange(false)
      onGone()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const close = () => { setMode('menu'); setConfirmEmail(''); onOpenChange(false) }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
            <span>Gerenciar conta</span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            Você está logado como <b>{user.email}</b>.
          </DialogDescription>
        </DialogHeader>

        {mode === 'menu' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('deactivate')}
              className="w-full text-left rounded-xl border p-4 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950 shrink-0">
                  <Moon className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">Desativar conta</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sua conta e dados ficam guardados. Reative fazendo login de novo.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('delete')}
              className="w-full text-left rounded-xl border border-red-200 dark:border-red-900 p-4 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950 shrink-0">
                  <Trash2 className="h-4 w-4 text-red-700 dark:text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-red-700 dark:text-red-400">Excluir conta permanentemente</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Remove sua conta, medicamentos, histórico e sessões. <b>Não pode ser desfeito.</b>
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {mode === 'deactivate' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm">
              <p className="font-medium mb-1">O que acontece ao desativar:</p>
              <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                <li>Você é deslogado imediatamente</li>
                <li>Suas sessões em todos os dispositivos são invalidadas</li>
                <li>Seus medicamentos e histórico <b>ficam guardados</b></li>
                <li>Para reativar, faça login novamente com o mesmo email</li>
              </ul>
            </div>
            <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
              <Button variant="ghost" onClick={() => setMode('menu')}>Voltar</Button>
              <Button onClick={deactivate} disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Moon className="h-4 w-4" />}
                Desativar conta
              </Button>
            </DialogFooter>
          </div>
        )}

        {mode === 'delete' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 text-sm">
              <p className="font-medium text-red-700 dark:text-red-400 mb-1">⚠️ Ação irreversível</p>
              <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                <li>Todos os seus medicamentos serão apagados</li>
                <li>Todo o histórico será apagado</li>
                <li>Se você é dono de uma família, ela será deletada ou passará para outro membro</li>
                <li>Você será removido de qualquer família compartilhada</li>
                <li><b>Não pode ser desfeito.</b> Para começar de novo, terá que cadastrar tudo.</li>
              </ul>
            </div>
            <div>
              <Label className="text-xs">Digite seu email <b className="font-mono">{user.email}</b> para confirmar:</Label>
              <Input
                value={confirmEmail}
                onChange={e => setConfirmEmail(e.target.value)}
                placeholder={user.email}
                autoComplete="off"
                className="mt-1"
              />
            </div>
            <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
              <Button variant="ghost" onClick={() => setMode('menu')}>Voltar</Button>
              <Button
                onClick={deleteAccount}
                disabled={loading || confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()}
                variant="destructive"
                className="gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir conta permanentemente
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
