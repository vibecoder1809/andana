import type { MetadataRoute } from 'next'

// Web app manifest — makes Andana installable to the home screen. Colors match
// the dark theme's --bg (#0a0e1a) so the splash and status bar blend in.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Andana — FGC en directe',
    short_name: 'Andana',
    description: 'Mapa en directe dels trens FGC amb planificador de viatges, properes sortides i ocupació per cotxe.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0e1a',
    theme_color: '#0a0e1a',
    categories: ['travel', 'navigation', 'utilities'],
    lang: 'ca',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
