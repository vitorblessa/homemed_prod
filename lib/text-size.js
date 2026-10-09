// Tamanho do texto escolhido pela pessoa (acessibilidade). Fica só neste
// aparelho: o ajuste vale para o aparelho, não para a conta. Todo o texto do
// app é em rem, então mudar o tamanho da fonte da página cresce tudo junto.

export const TEXT_SIZE_KEY = 'homemed_text_size'

export const TEXT_SIZES = [
  { id: 'normal', label: 'Normal', percent: 100 },
  { id: 'large', label: 'Grande', percent: 118 },
  { id: 'xlarge', label: 'Muito grande', percent: 135 },
]

export function normalizeTextSize(id) {
  return TEXT_SIZES.some(s => s.id === id) ? id : 'normal'
}

export function textSizePercent(id) {
  return TEXT_SIZES.find(s => s.id === normalizeTextSize(id)).percent
}

export function getTextSize() {
  try { return normalizeTextSize(localStorage.getItem(TEXT_SIZE_KEY)) } catch { return 'normal' }
}

export function applyTextSize(id) {
  if (typeof document === 'undefined') return
  document.documentElement.style.fontSize = textSizePercent(id) + '%'
}

export function saveTextSize(id) {
  const v = normalizeTextSize(id)
  try { localStorage.setItem(TEXT_SIZE_KEY, v) } catch { /* ignore */ }
  applyTextSize(v)
  return v
}

// Roda antes da primeira pintura (inline no <head>), para o texto não "pular" de tamanho.
export const TEXT_SIZE_BOOT_SCRIPT =
  `try{var s=localStorage.getItem('${TEXT_SIZE_KEY}');var p={large:118,xlarge:135}[s];if(p)document.documentElement.style.fontSize=p+'%'}catch(e){}`
