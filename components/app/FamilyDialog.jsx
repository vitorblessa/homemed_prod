'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2, Check, LogOut, Users, Copy, UserPlus, UserMinus, RefreshCw } from 'lucide-react'

/* ============ AI ASSISTANT SHEET ============ */
/* ============ FAMILY SHARING DIALOG ============ */
export function FamilyDialog({ open, onOpenChange, currentEmail, onChanged }) {
  const [loading, setLoading] = useState(true)
  const [family, setFamily] = useState(null)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [newName, setNewName] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/families/me', { credentials: 'include' })
      const data = await res.json()
      setFamily(data.family || null)
    } catch (e) {
      toast.error('Erro ao carregar família')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (open) load() }, [open])

  const createFamily = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/families', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName || 'Minha Família' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao criar')
      setFamily(data.family)
      toast.success('Família criada! Compartilhe o código com sua família.')
      onChanged()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setCreating(false)
    }
  }

  const joinFamily = async () => {
    if (!inviteCode.trim()) return
    setJoining(true)
    try {
      const res = await fetch('/api/families/join', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: inviteCode.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Código inválido')
      toast.success(`Entrou na família ${data.family?.name || ''}!`)
      onChanged()
      await load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setJoining(false)
    }
  }

  const leaveFamily = async () => {
    if (!confirm('Sair da família? Os medicamentos ficarão com os outros membros.')) return
    try {
      await fetch('/api/families/leave', { method: 'POST', credentials: 'include' })
      toast.success('Você saiu da família')
      setFamily(null)
      onChanged()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const removeMember = async (email) => {
    if (!confirm(`Remover ${email} da família?`)) return
    try {
      const res = await fetch(`/api/families/members/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Erro ao remover')
      toast.success('Membro removido')
      await load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const regenCode = async () => {
    try {
      const res = await fetch('/api/families/regenerate-code', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro')
      toast.success('Novo código gerado')
      await load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const copyCode = () => {
    if (!family?.invite_code) return
    navigator.clipboard.writeText(family.invite_code).then(() => {
      toast.success('Código copiado!')
    })
  }

  const isOwner = family && family.owner_email === currentEmail

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Users className="h-5 w-5 text-blue-600 shrink-0" />
            <span>Compartilhamento familiar</span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            Compartilhe sua farmácia com pai, mãe, filhos ou outros familiares.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : family ? (
          <div className="space-y-4">
            <div className="rounded-xl border p-4 bg-gradient-to-br from-blue-50 to-emerald-50 dark:from-blue-950/30 dark:to-emerald-950/30">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Família</p>
              <p className="font-bold text-lg">{family.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{family.members?.length || 0} membro{family.members?.length !== 1 ? 's' : ''}</p>
            </div>

            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Código de convite</p>
                {isOwner && (
                  <Button variant="ghost" size="sm" onClick={regenCode} className="h-7 text-xs gap-1">
                    <RefreshCw className="h-3 w-3" /> Novo
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <div className="flex-1 font-mono font-bold text-xl tracking-widest text-center py-2 bg-muted rounded-md">
                  {family.invite_code}
                </div>
                <Button variant="outline" onClick={copyCode} className="gap-2">
                  <Copy className="h-4 w-4" /> Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Envie esse código para os familiares — eles usam para entrar aqui.
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Membros</p>
              <ul className="space-y-2">
                {(family.members || []).map(m => (
                  <li key={m.email} className="flex items-center gap-3 rounded-lg border p-2">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0 overflow-hidden">
                      {m.picture
                        ? <img src={m.picture} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        : (m.name || m.email || '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {m.name || m.email}
                        {family.owner_email === m.email && <span className="text-xs text-blue-600 ml-2">dono</span>}
                        {m.email === currentEmail && <span className="text-xs text-muted-foreground ml-2">(você)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    {isOwner && m.email !== currentEmail && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMember(m.email)}
                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t">
              <Button variant="destructive" onClick={leaveFamily} className="w-full gap-2">
                <LogOut className="h-4 w-4" /> Sair da família
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Create */}
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold">Criar uma nova família</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Você vira o dono. Seus {' '}
                <b>medicamentos atuais</b> serão migrados para a família.
              </p>
              <div className="flex flex-col gap-2">
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Nome (ex: Família Silva)"
                />
                <Button onClick={createFamily} disabled={creating} className="gap-2">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Criar família
                </Button>
              </div>
            </div>

            <div className="text-center text-xs text-muted-foreground">— OU —</div>

            {/* Join */}
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold">Entrar em uma família</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Peça o código de 10 caracteres para alguém que já criou uma família.
              </p>
              <div className="flex gap-2">
                <Input
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="ABC123DEF4"
                  className="font-mono tracking-widest uppercase"
                  onKeyDown={e => e.key === 'Enter' && joinFamily()}
                />
                <Button onClick={joinFamily} disabled={joining || !inviteCode.trim()} className="gap-2 shrink-0">
                  {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Entrar
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
