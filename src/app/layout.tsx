import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })

export const metadata: Metadata = {
  title: 'Andana — trens FGC en directe',
  description: 'Mapa en directe dels trens FGC amb planificador de viatges, properes sortides i ocupació per cotxe',
  // The <link rel="manifest"> is injected automatically from app/manifest.ts.
  applicationName: 'Andana',
  appleWebApp: { capable: true, title: 'Andana', statusBarStyle: 'black-translucent' },
  icons: { icon: '/logo.svg', apple: '/apple-icon.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Extend under notches/home bar; the mobile layout pads with safe-area env().
  viewportFit: 'cover',
  themeColor: '#0a0e1a',
  // Android: shrink the layout viewport when the keyboard opens, so the
  // bottom-sheet inputs stay visible instead of hiding behind the keyboard.
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
