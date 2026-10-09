'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Sparkles, Loader2, Info, Send } from 'lucide-react'

// Renders the assistant's light markdown (**bold**, "- " / "1. " lists, line
// breaks) so the chat doesn't show raw asterisks.
export function ChatText({ text }) {
  const inline = (s, k) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part)
      ? <strong key={`${k}-${i}`}>{part.slice(2, -2)}</strong>
      : part.replace(/\*\*/g, '')
  )
  const blocks = []
  let list = null
  String(text || '').replace(/\r/g, '').split('\n').forEach((raw, idx) => {
    const line = raw.trim()
    const item = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/)
    if (item) {
      if (!list) { list = []; blocks.push({ type: 'list', items: list }) }
      list.push(item[1])
    } else {
      list = null
      if (line) blocks.push({ type: 'p', text: line, idx })
    }
  })
  return (
    <div className="space-y-1.5 leading-relaxed">
      {blocks.map((b, i) => b.type === 'list' ? (
        <ul key={i} className="list-disc pl-5 space-y-1">
          {b.items.map((it, j) => <li key={j}>{inline(it, `${i}-${j}`)}</li>)}
        </ul>
      ) : <p key={i}>{inline(b.text, i)}</p>)}
    </div>
  )
}

export function AIAssistantSheet({ open, onOpenChange }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Olá! Sou seu assistente HomeMed AI. Pergunte coisas como: "Tenho algum antialérgico em casa?" ou "Qual remédio tenho para dor de cabeça?"' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const send = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages(m => [...m, { role: 'user', text: q }])
    setLoading(true)
    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro')
      setMessages(m => [...m, { role: 'assistant', text: data.answer }])
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', text: 'Erro: ' + e.message }])
    } finally {
      setLoading(false)
    }
  }

  const suggestions = [
    'Tenho algum antialérgico?',
    'O que serve para dor?',
    'Algum remédio vencendo em breve?',
    'Preciso de receita para algum?',
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full !max-w-full sm:!max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 sm:p-6 pb-4 border-b pr-12">
          <SheetTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="truncate">Assistente HomeMed AI</span>
          </SheetTitle>
        </SheetHeader>

        {/* Disclaimer */}
        <div className="mx-4 mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex gap-2 text-xs text-amber-900 dark:text-amber-200">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <p className="leading-relaxed">
            Esta é apenas uma consulta aos seus medicamentos cadastrados. Caso os sintomas persistam, um médico deverá ser consultado.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-muted rounded-bl-sm'
              }`}>
                {m.role === 'user' ? m.text : <ChatText text={m.text} />}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>

        {messages.length === 1 && (
          <div className="px-4 pb-2 flex gap-2 flex-wrap">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="text-xs rounded-full border px-3 py-1.5 hover:bg-accent transition"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="p-4 pb-[calc(1rem+var(--safe-area-inset-bottom,0px))] border-t flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Pergunte algo..."
            disabled={loading}
          />
          <Button onClick={send} disabled={loading || !input.trim()} size="icon" className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
