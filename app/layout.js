import './globals.css'
import { Providers } from './providers'

export const metadata = {
  title: 'HomeMed - Sua farmácia doméstica inteligente',
  description: 'Controle os medicamentos da sua casa com inteligência artificial. Nunca mais perca uma validade.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HomeMed',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#2563EB',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
