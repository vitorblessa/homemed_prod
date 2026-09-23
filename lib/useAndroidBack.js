'use client'

import { useEffect } from 'react'

// A small stack of "things that are currently open" (dialogs, sheets,
// scanners...). The Android hardware back button always closes whatever is
// on top of the stack instead of letting the WebView navigate its own
// history (which is what was sending users back to the login screen).
const stack = []
let listenerReady = false
let CapacitorAppRef = null

function ensureListener() {
  if (listenerReady) return
  listenerReady = true

  // Only wire this up on native Android/iOS via Capacitor. On the regular
  // web build this file simply does nothing.
  if (typeof window === 'undefined') return

  import('@capacitor/core').then(({ Capacitor }) => {
    if (!Capacitor.isNativePlatform()) return

    import('@capacitor/app').then(({ App }) => {
      CapacitorAppRef = App
      App.addListener('backButton', () => {
        if (stack.length > 0) {
          // Close the topmost open dialog/sheet/scanner instead of
          // navigating the WebView history.
          const top = stack[stack.length - 1]
          top.onBack()
          return
        }
        // Nothing open (we're on a "root" screen, whether that's the
        // dashboard or the login screen): minimize the app, the standard
        // Android behavior, instead of ever falling back into old
        // WebView history (which used to land on the auth screen).
        App.minimizeApp()
      })
    })
  })
}

let nextId = 0

/**
 * Registers `onBack` to be called when the Android back button is pressed
 * while `active` is true. Multiple dialogs can be active at once (e.g. the
 * barcode scanner opened on top of the "add medicine" dialog) — the most
 * recently opened one is closed first.
 */
export function useAndroidBack(active, onBack) {
  useEffect(() => {
    ensureListener()
    if (!active) return

    const id = ++nextId
    stack.push({ id, onBack })

    return () => {
      const idx = stack.findIndex((entry) => entry.id === id)
      if (idx !== -1) stack.splice(idx, 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}
