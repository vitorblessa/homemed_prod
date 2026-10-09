import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Guardas simples de acessibilidade: pegam o que costuma voltar sem querer.

const ROOT = path.resolve(import.meta.dirname, '../..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

function sourceFiles(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(e => {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'ui' || e.name === 'node_modules' ? [] : sourceFiles(rel)
    return /\.(jsx?|css)$/.test(e.name) ? [rel] : []
  })
}

// Luminância relativa (WCAG) de uma cor HSL "h s% l%".
function contrast(hslA, hslB) {
  const lum = ([h, s, l]) => {
    s /= 100; l /= 100
    const k = n => (n + h / 30) % 12
    const a = s * Math.min(l, 1 - l)
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    const [r, g, b] = [f(0), f(8), f(4)].map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const [x, y] = [lum(hslA), lum(hslB)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const token = (css, scope, name) => {
  const block = css.split(scope)[1]
  const m = block.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`))
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

describe('acessibilidade', () => {
  it('não bloqueia o zoom por gesto (idosos precisam ampliar a tela)', () => {
    expect(read('app/layout.js')).not.toMatch(/maximumScale|userScalable/)
  })

  it('nenhum texto menor que 12px nas telas', () => {
    const offenders = [...sourceFiles('app'), ...sourceFiles('components')]
      .filter(f => /text-\[(\d|1[01])px\]/.test(read(f)))
    expect(offenders).toEqual([])
  })

  it('o texto secundário tem contraste de pelo menos 4,5:1 nos dois temas', () => {
    const css = read('app/globals.css')
    expect(contrast(token(css, ':root', 'muted-foreground'), token(css, ':root', 'muted'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token(css, ':root', 'muted-foreground'), token(css, ':root', 'background'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token(css, '.dark', 'muted-foreground'), token(css, '.dark', 'background'))).toBeGreaterThanOrEqual(4.5)
  })

  it('os selos de validade não usam fundos claros demais com texto branco', () => {
    const src = read('components/app/ui-bits.jsx')
    expect(src).not.toMatch(/bg-(orange|yellow|red|blue)-(100|200|300|400|500)[^"]*text-white/)
  })

  it('o tamanho do texto é ajustável nas configurações', () => {
    expect(read('components/SettingsSheet.jsx')).toContain('Tamanho do texto')
  })
})

describe('app no Android', () => {
  it('mantém o espaço da barra de status quando um menu ou painel trava a rolagem', () => {
    const css = read('app/globals.css')
    const rule = css.match(/body\[data-scroll-locked\]\s*\{[^}]*\}/)?.[0] || ''
    expect(rule).toContain('safe-area-inset-top')
    expect(rule).toContain('!important')
  })
})
