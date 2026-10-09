import { describe, it, expect } from 'vitest'
import { normalizeTextSize, textSizePercent, TEXT_SIZES, TEXT_SIZE_BOOT_SCRIPT } from '@/lib/text-size'

describe('tamanho do texto', () => {
  it('valores desconhecidos viram normal', () => {
    expect(normalizeTextSize('xlarge')).toBe('xlarge')
    expect(normalizeTextSize('gigante')).toBe('normal')
    expect(normalizeTextSize(null)).toBe('normal')
  })

  it('cada nível é maior que o anterior e o normal é 100%', () => {
    const p = TEXT_SIZES.map(s => textSizePercent(s.id))
    expect(p[0]).toBe(100)
    expect([...p].sort((a, b) => a - b)).toEqual(p)
    expect(new Set(p).size).toBe(p.length)
  })

  it('o script de abertura usa as mesmas porcentagens dos níveis', () => {
    for (const s of TEXT_SIZES.filter(s => s.id !== 'normal')) {
      expect(TEXT_SIZE_BOOT_SCRIPT).toContain(`${s.id}:${s.percent}`)
    }
  })
})
