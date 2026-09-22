'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Loader2, ScanLine, RefreshCw, AlertCircle, Camera } from 'lucide-react'

const READER_ID = 'homemed-barcode-reader'

function isSecureContext() {
  if (typeof window === 'undefined') return true
  return window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost'
}

// Score a camera by its label — prefer main back camera (not ultrawide, not telephoto)
function scoreCamera(cam) {
  const label = (cam.label || '').toLowerCase()
  let score = 0
  if (/back|traseira|rear|environment/.test(label)) score += 100
  if (/front|frontal|user/.test(label)) score -= 100
  if (/wide|angular|ultra/.test(label)) score -= 30
  if (/tele|zoom/.test(label)) score -= 20
  if (/depth|tof|monochrome|mono|infrared|ir/.test(label)) score -= 90
  if (/\b0\b|camera 0|camera0/.test(label)) score += 10
  return score
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Safely stop scanner without throwing "Cannot stop, scanner is not running or paused"
async function safeStop(scanner) {
  if (!scanner) return
  try {
    // Html5QrcodeScannerState: NOT_STARTED=1, SCANNING=2, PAUSED=3
    const state = typeof scanner.getState === 'function' ? scanner.getState() : null
    if (state === 2 || state === 3) {
      await scanner.stop()
    }
  } catch (_e) { /* ignore */ }
  try { scanner.clear() } catch (_e) { /* ignore */ }
}

export default function BarcodeScanner({ open, onClose, onDetected }) {
  const html5QrRef = useRef(null)
  const startedRef = useRef(false)
  const startTokenRef = useRef(0)

  const [phase, setPhase] = useState('idle')
  const [error, setError] = useState('')
  const [errorHint, setErrorHint] = useState('')
  const [cameras, setCameras] = useState([])
  const [cameraId, setCameraId] = useState(null)
  const [manualCode, setManualCode] = useState('')
  const [showManual, setShowManual] = useState(false)

  useEffect(() => {
    if (!open) return
    const myToken = ++startTokenRef.current
    let cancelled = false

    async function stopExisting() {
      const prev = html5QrRef.current
      if (prev) {
        await safeStop(prev)
        html5QrRef.current = null
        startedRef.current = false
        // Give the camera resource time to be released fully
        await sleep(400)
      }
    }

    async function start() {
      setError('')
      setErrorHint('')
      setPhase('requesting')

      if (!isSecureContext()) {
        setError('Câmera requer HTTPS.')
        setPhase('error')
        return
      }
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador não suporta câmera.')
        setPhase('error')
        return
      }

      await stopExisting()
      if (cancelled || myToken !== startTokenRef.current) return

      let Html5Qrcode, Html5QrcodeSupportedFormats
      try {
        const mod = await import('html5-qrcode')
        Html5Qrcode = mod.Html5Qrcode
        Html5QrcodeSupportedFormats = mod.Html5QrcodeSupportedFormats
      } catch (e) {
        setError('Erro ao carregar scanner')
        setErrorHint(e?.message || '')
        setPhase('error')
        return
      }
      if (cancelled || myToken !== startTokenRef.current) return

      // Enumerate cameras — this ALSO triggers the browser's permission prompt in html5-qrcode
      let allCams = []
      try {
        allCams = await Html5Qrcode.getCameras()
      } catch (e) {
        console.error('getCameras error:', e)
        const name = e?.name || ''
        const msg = e?.message || String(e)
        if (name === 'NotAllowedError' || /permission|denied|allowed/i.test(msg)) {
          setError('Permissão de câmera negada.')
          setErrorHint('Toque no cadeado 🔒 na barra do navegador → Permissões → autorize a câmera. Depois recarregue a página.')
        } else {
          setError(msg || 'Erro ao acessar câmera')
        }
        setPhase('error')
        return
      }
      if (cancelled || myToken !== startTokenRef.current) return

      if (!allCams || allCams.length === 0) {
        setError('Nenhuma câmera encontrada.')
        setPhase('error')
        return
      }
      setCameras(allCams)

      // Pick best back camera (skip cameraId that is stale from previous session)
      let chosenId = cameraId && allCams.some(c => c.id === cameraId) ? cameraId : null
      if (!chosenId) {
        const withScores = allCams.map(c => ({ ...c, _score: scoreCamera(c) }))
        withScores.sort((a, b) => b._score - a._score)
        chosenId = withScores[0].id
        // Update state but don't wait (will be reflected in next render)
        setCameraId(chosenId)
      }

      // Small delay before starting to let any prior camera hold release
      await sleep(200)
      if (cancelled || myToken !== startTokenRef.current) return

      const scanner = new Html5Qrcode(READER_ID, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.AZTEC,
          Html5QrcodeSupportedFormats.PDF_417,
        ],
        verbose: false,
      })
      html5QrRef.current = scanner

      const config = {
        fps: 12,
        qrbox: (w, h) => {
          const size = Math.floor(Math.min(w, h) * 0.75)
          return { width: size, height: Math.floor(size * 0.55) }
        },
        aspectRatio: undefined,
        disableFlip: false,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        videoConstraints: {
          deviceId: { exact: chosenId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      }

      async function tryStart(target) {
        return scanner.start(
          target,
          config,
          (decodedText) => {
            if (cancelled || myToken !== startTokenRef.current) return
            try { navigator.vibrate?.(120) } catch (_e) { /* ignore */ }
            // Safely stop then callback
            safeStop(scanner).finally(() => {
              if (!cancelled) onDetected(decodedText)
            })
          },
          (_frameErr) => { /* ignore per-frame errors */ }
        )
      }

      setPhase('scanning')
      try {
        await tryStart(chosenId)
        startedRef.current = true
      } catch (e) {
        console.error('scanner.start error:', e)
        const name = e?.name || ''
        const msg = e?.message || String(e)

        // Fallback: try again with facingMode instead of specific deviceId
        if (!cancelled && myToken === startTokenRef.current && /NotReadable|NotFound|Overconstrained|Constraint/.test(name + ' ' + msg)) {
          await sleep(500)
          await safeStop(scanner)
          await sleep(400)
          try {
            const fallbackConfig = { ...config, videoConstraints: undefined }
            await scanner.start(
              { facingMode: 'environment' },
              fallbackConfig,
              (decodedText) => {
                if (cancelled) return
                try { navigator.vibrate?.(120) } catch (_e) { /* ignore */ }
                safeStop(scanner).finally(() => {
                  if (!cancelled) onDetected(decodedText)
                })
              },
              (_frameErr) => { /* ignore */ }
            )
            startedRef.current = true
            return
          } catch (e2) {
            console.error('fallback scanner.start error:', e2)
            const msg2 = e2?.message || String(e2)
            if (/NotAllowed|permission|denied/i.test(msg2)) {
              setError('Permissão de câmera negada.')
              setErrorHint('Autorize a câmera nas permissões do navegador.')
            } else if (/NotReadable|Could not start|in use/i.test(msg2)) {
              setError('Câmera indisponível.')
              setErrorHint('Feche outros apps que usem a câmera (Câmera, WhatsApp, Zoom, Google Meet) e tente novamente. Se não resolver, troque a câmera pelo botão 🔄 abaixo.')
            } else {
              setError(msg2 || 'Erro ao iniciar câmera')
              setErrorHint('Troque a câmera abaixo ou digite o código manualmente.')
            }
            setPhase('error')
            return
          }
        }

        if (name === 'NotAllowedError' || /permission|denied|allowed/i.test(msg)) {
          setError('Permissão de câmera negada.')
          setErrorHint('Autorize a câmera no navegador e recarregue.')
        } else if (/NotReadable|Could not start|in use/i.test(name + ' ' + msg)) {
          setError('Câmera indisponível.')
          setErrorHint('Feche outros apps que usem a câmera (Câmera, WhatsApp, Zoom) e tente novamente. Ou troque a câmera pelo botão 🔄.')
        } else {
          setError(msg || 'Erro ao iniciar câmera')
          setErrorHint('Tente trocar a câmera ou digitar o código manualmente.')
        }
        setPhase('error')
      }
    }

    start()

    return () => {
      cancelled = true
      const s = html5QrRef.current
      if (s) {
        safeStop(s)
      }
      html5QrRef.current = null
      startedRef.current = false
    }
  }, [open, cameraId, onDetected])

  const nextCamera = () => {
    if (cameras.length < 2) return
    const idx = cameras.findIndex(c => c.id === cameraId)
    const nxt = cameras[(idx + 1) % cameras.length]
    setCameraId(nxt.id)
  }

  const retry = () => {
    setPhase('idle')
    setError('')
    const current = cameraId
    setCameraId(null)
    setTimeout(() => setCameraId(current || null), 30)
  }

  const submitManual = () => {
    const code = manualCode.trim()
    if (!code) return
    onDetected(code)
  }

  if (!open) return null

  const currentCam = cameras.find(c => c.id === cameraId)

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 text-white bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2 min-w-0">
          <ScanLine className="h-5 w-5 shrink-0" />
          <span className="font-semibold truncate">Escanear código</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {cameras.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={nextCamera}
              className="text-white hover:bg-white/10"
              title="Trocar câmera"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
        <div id={READER_ID} className="w-full h-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />

        {phase === 'requesting' && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white gap-4 px-6 text-center z-10">
            <Camera className="h-12 w-12 text-emerald-400" />
            <Loader2 className="h-6 w-6 animate-spin" />
            <div>
              <p className="font-semibold">Iniciando câmera...</p>
              <p className="text-sm text-white/70 mt-1">Toque em <b>Permitir</b> se pedir permissão.</p>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center text-white gap-4 px-6 text-center overflow-y-auto py-10 z-10">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <div className="max-w-sm">
              <p className="font-semibold text-lg">{error}</p>
              {errorHint && <p className="text-sm text-white/80 mt-2 leading-relaxed">{errorHint}</p>}
            </div>

            <div className="flex flex-col gap-2 w-full max-w-xs pt-2">
              <Button onClick={retry} variant="secondary" className="w-full gap-2">
                <RefreshCw className="h-4 w-4" /> Tentar novamente
              </Button>
              {cameras.length > 1 && (
                <Button onClick={nextCamera} variant="outline" className="w-full bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white gap-2">
                  <Camera className="h-4 w-4" /> Trocar câmera ({cameras.length})
                </Button>
              )}
              <Button
                onClick={() => setShowManual(v => !v)}
                variant="outline"
                className="w-full bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
              >
                Digitar código manualmente
              </Button>
              {showManual && (
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={manualCode}
                    onChange={e => setManualCode(e.target.value)}
                    placeholder="Ex: 7891058014100"
                    className="flex-1 rounded-md bg-white/10 border border-white/30 text-white placeholder:text-white/50 px-3 py-2 text-sm"
                    onKeyDown={e => e.key === 'Enter' && submitManual()}
                    autoFocus
                  />
                  <Button onClick={submitManual} disabled={!manualCode.trim()}>OK</Button>
                </div>
              )}
              <Button onClick={onClose} variant="ghost" className="w-full text-white hover:bg-white/10">
                Fechar
              </Button>
            </div>
          </div>
        )}

        {phase === 'scanning' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
            <div className="relative w-[80%] max-w-md aspect-[4/3]">
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl"></div>
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl"></div>
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl"></div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl"></div>
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.9)] animate-pulse"></div>
            </div>
          </div>
        )}
      </div>

      {phase === 'scanning' && (
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-6 text-white bg-gradient-to-t from-black/95 to-transparent">
          <p className="text-center text-sm text-white/95 font-medium mb-2">
            📷 Aponte para o código de barras
          </p>
          {cameras.length > 1 && (
            <div className="max-w-md mx-auto">
              <select
                value={cameraId || ''}
                onChange={e => setCameraId(e.target.value)}
                className="w-full bg-white/10 border border-white/30 text-white text-xs rounded-md px-3 py-2 backdrop-blur"
              >
                {cameras.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-900">
                    {c.label || `Câmera ${c.id.slice(0, 8)}`}
                  </option>
                ))}
              </select>
              <p className="text-center text-[10px] text-white/60 mt-1">
                Se não focar, troque a câmera acima
              </p>
            </div>
          )}
          {cameras.length <= 1 && currentCam && (
            <p className="text-center text-[10px] text-white/60 mt-1">
              {currentCam.label || 'Câmera'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
