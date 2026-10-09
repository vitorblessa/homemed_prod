'use client'

// Saves a generated file (PDF / XLSX / CSV).
//
// Browser/PWA: normal download through an <a download>.
// Android app: the WebView gives no feedback for blob downloads, so the native
// "FileSaver" plugin (android/.../FileSaverPlugin.java) writes the file to
// Downloads and posts a notification that opens it. Older builds without the
// plugin fall back to the browser download.

import { Capacitor, registerPlugin } from '@capacitor/core'
import { toast } from 'sonner'

const FileSaver = registerPlugin('FileSaver')

export function hasNativeFileSaver() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('FileSaver')
  } catch { return false }
}

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

function browserDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function saveFile(blob, filename) {
  if (!hasNativeFileSaver()) {
    browserDownload(blob, filename)
    toast.success('Arquivo gerado')
    return
  }
  try {
    const mimeType = blob.type || 'application/octet-stream'
    const base64 = await blobToBase64(blob)
    const res = await FileSaver.saveAndNotify({ filename, mimeType, base64 })
    if (res?.notified) {
      toast.success('Arquivo salvo em Downloads', { description: 'Toque na notificação para abrir.' })
    } else {
      // Notifications blocked: offer to open it right here instead.
      toast.success('Arquivo salvo em Downloads', {
        description: filename,
        duration: 10000,
        action: { label: 'Abrir', onClick: () => FileSaver.openFile({ uri: res.uri, mimeType }).catch(() => toast.error('Nenhum app encontrado para abrir este arquivo')) },
      })
    }
  } catch (e) {
    console.error('saveFile', e)
    toast.error('Não foi possível salvar o arquivo')
  }
}
