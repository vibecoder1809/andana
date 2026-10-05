<!-- BEGIN:nextjs-agent-rules -->
# Next.js 16.2.9 Rules
Breaking changes from older versions: App Router, Turbopack. Check `node_modules/next/dist/docs/`.
<!-- END:nextjs-agent-rules -->

# Andana — Core Agent Rules & Constraints

> **Mandatory Workflow:**
> 1. Check [`project_memory.md`](project_memory.md) for active state and recent context.
> 2. Log changes in [`project_memory.md`](project_memory.md) under Session Log before finishing (max 10 lines).
> 3. **Never `git push`** automatically. Only push when explicitly requested by user.

## Stack & Verification
- Next.js 16.2.9, React 19, TypeScript strict, MapLibre GL (`react-map-gl/maplibre`), CSS vars + inline `style={{}}`.
- Verify: `npm test` (infra), `npx tsc --noEmit` (0 TS errors), `npm run build` (Turbopack build). Windows: use `cmd /c npm ...` if blocked.

## Architectural Boundaries
1. **Server vs Client:** `src/app/api/*` wraps `src/lib/*`. Client components are `'use client'` and fetch via `/api/...`. Never import `src/lib/fgc.ts` or server fetchers into client. Shared types live in `src/types/index.ts`.
2. **Dual-Root Parity:** Desktop root (`App.tsx`) and mobile root (`MobileLayout.tsx`) each manage state. Any UI feature, modal, or telemetry must be wired into **both**.
3. **Zero Fake Dynamics:** No fake metrics, mock countdowns, or hardcoded tracks. Telemetry derives from real GTFS-RT or Renfe feeds; missing data renders clean fallbacks.
4. **Trilingual i18n:** All UI strings in `DICT` in `src/lib/i18n.tsx` (`ca` source, `es`, `en`). Use `const { t } = useI18n()` and `t('key')`. Never hardcode raw UI strings.
5. **Styling:** Inline styles + CSS variables (`globals.css`), `data-theme="dark|light"`. Dark mode tokens in `:root` must stay intact. No Tailwind utility soups.
6. **Key Subsystems:** `interpolate.ts` (60fps train dead-reckoning), `planner.ts` (CSA routing + footpaths), `searchUtils.ts` (accent/diacritic-insensitive matching), `fares.ts` (ATM zones), `metroInterchanges.ts` (TMB Metro/Tram links).
