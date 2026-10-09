import { describe, it, expect, vi, beforeEach } from 'vitest'

const toast = { success: vi.fn(), error: vi.fn() }
vi.mock('sonner', () => ({ toast }))

const plugin = { saveAndNotify: vi.fn(), openFile: vi.fn() }
let native = false
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native, isPluginAvailable: () => native },
  registerPlugin: () => plugin,
}))

const { saveFile } = await import('@/lib/save-file')

describe('saveFile', () => {
  beforeEach(() => { vi.clearAllMocks(); native = false })

  it('baixa pelo navegador quando não é o app', async () => {
    const click = vi.fn()
    const a = { click }
    globalThis.document = { createElement: () => a, body: { appendChild() {}, removeChild() {} } }
    globalThis.URL.createObjectURL = () => 'blob:x'
    globalThis.URL.revokeObjectURL = () => {}
    await saveFile(new Blob(['x']), 'a.csv')
    expect(click).toHaveBeenCalled()
    expect(a.download).toBe('a.csv')
    expect(plugin.saveAndNotify).not.toHaveBeenCalled()
    delete globalThis.document
  })

  it('no app salva pelo plugin nativo e avisa para tocar na notificação', async () => {
    native = true
    plugin.saveAndNotify.mockResolvedValue({ uri: 'content://x', notified: true })
    await saveFile(new Blob(['abc'], { type: 'text/csv' }), 'a.csv')
    const arg = plugin.saveAndNotify.mock.calls[0][0]
    expect(arg).toMatchObject({ filename: 'a.csv', mimeType: 'text/csv', base64: 'YWJj' })
    expect(toast.success.mock.calls[0][1].description).toMatch(/notificação/)
  })

  it('com notificações bloqueadas oferece o botão Abrir', async () => {
    native = true
    plugin.saveAndNotify.mockResolvedValue({ uri: 'content://x', notified: false })
    plugin.openFile.mockResolvedValue()
    await saveFile(new Blob(['abc'], { type: 'text/csv' }), 'a.csv')
    const opts = toast.success.mock.calls[0][1]
    expect(opts.action.label).toBe('Abrir')
    opts.action.onClick()
    expect(plugin.openFile).toHaveBeenCalledWith({ uri: 'content://x', mimeType: 'text/csv' })
  })

  it('mostra erro se o plugin falhar', async () => {
    native = true
    plugin.saveAndNotify.mockRejectedValue(new Error('x'))
    await saveFile(new Blob(['abc']), 'a.pdf')
    expect(toast.error).toHaveBeenCalled()
  })
})
