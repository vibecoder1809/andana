import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })

export const metadata: Metadata = {
  title: 'Andana — Mapa en temps real de FGC i Rodalies de Catalunya',
  description: 'Mapa interactiu en directe dels trens FGC i Rodalies (Renfe) a Catalunya. Horaris en temps real, properes sortides amb retards, alertes de servei i planificador de rutes.',
  keywords: [
    'FGC en temps real', 'Rodalies de Catalunya en directe', 'horaris trens Barcelona',
    'Geotren FGC', 'retards Rodalies', 'planificador viatges Catalunya',
    'FGC live train map', 'Barcelona train tracker', 'Rodalies live status', 'trens Catalunya'
  ],
  applicationName: 'Andana',
  appleWebApp: { capable: true, title: 'Andana', statusBarStyle: 'black-translucent' },
  icons: { icon: '/logo.svg', apple: '/apple-icon.png' },
  openGraph: {
    type: 'website',
    locale: 'ca_ES',
    alternateLocale: ['es_ES', 'en_US'],
    title: 'Andana — Mapa en temps real de FGC i Rodalies de Catalunya',
    description: 'Trens en directe, properes sortides amb retards en temps real, alertes de servei i planificador de rutes per a FGC i Rodalies Renfe.',
    siteName: 'Andana',
  },
  twitter: {
    card: 'summary',
    title: 'Andana — Mapa en temps real de FGC i Rodalies',
    description: 'Trens en directe, properes sortides amb retards en temps real, alertes de servei i planificador de rutes per a FGC i Rodalies.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Andana',
  applicationCategory: 'TravelApplication',
  operatingSystem: 'All',
  description: 'Real-time train tracker, departures board, service alerts, and journey planner for FGC and Rodalies (Renfe) networks in Catalonia.',
  inLanguage: ['ca', 'es', 'en'],
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'EUR',
  },
  areaServed: {
    '@type': 'AdministrativeArea',
    name: 'Catalonia, Spain',
  },
  featureList: [
    'Live train positions for FGC and Rodalies on an interactive MapLibre map',
    'Live departures board with real-time delay countdowns',
    'Official service alerts with corridor grouping and historical timestamps',
    'Connection Scan Algorithm journey planner with transfer optimization',
    'Per-car occupancy indicator for FGC trains',
    'Step-free station accessibility itineraries',
    'Progressive Web App (PWA) with offline shell caching'
  ],
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
    <html lang="ca" className={`${inter.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var f=localStorage.getItem('andana-font-size');if(f)document.documentElement.setAttribute('data-font',f);var t=localStorage.getItem('andana-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
