'use client'

// Presentational surface for the reliability history: "L6 usually runs +4 min
// late around 08:00". Renders nothing when there's no trustworthy history for
// the slot, so it can be dropped anywhere and simply lights up once the capture
// cron has accrued enough data (see docs/reliability.md).

import { LINE_COLORS } from '@/lib/constants'
import { useI18n } from '@/lib/i18n'
import { typicalAt, useReliability, minutesOfDay, dayTypeOf, type Typical } from '@/lib/reliability'

function fmtSlot(minuteOfDay: number): string {
  const wrapped = ((Math.floor(minuteOfDay) % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// One decimal, but only when it carries information ("4" not "4.0").
function fmtDelay(min: number): string {
  return Number.isInteger(min) ? String(min) : min.toFixed(1)
}

interface Props {
  line: string
  /** Moment to describe, in minutes since local midnight. */
  minuteOfDay: number
  /** Day the journey falls on; defaults to today. Drives weekday/weekend. */
  date?: Date
  /** Compact inline phrasing ("usually +4 min late") for dense lists. */
  compact?: boolean
  /** Suppress when a live delay is already shown, to avoid saying it twice. */
  hidden?: boolean
}

/**
 * Reliability note for one line at one time of day. Returns null (renders
 * nothing) when history is missing or too thin — the caller needs no guard.
 */
export function ReliabilityNote({ line, minuteOfDay, date, compact = false, hidden = false }: Props) {
  const { t } = useI18n()
  const stats = useReliability(hidden ? [] : [line])
  const typical = typicalAt(stats[line], minuteOfDay, dayTypeOf(date ?? new Date()))

  if (hidden || !typical) return null

  const slot = fmtSlot(minuteOfDay)
  const title = `${typical.onTime
    ? t('typicallyOnTime', line, slot)
    : t('typicallyLate', line, fmtDelay(typical.median), slot)}. ${t('basedOnHistory', typical.samples)}.`

  if (compact) {
    return (
      <span
        title={title}
        style={{ fontSize: 10, color: typical.onTime ? 'var(--green)' : 'var(--yellow)', fontWeight: 600, whiteSpace: 'nowrap' }}
      >
        {typical.onTime ? t('typicalShortOnTime') : t('typicalShortLate', fmtDelay(typical.median))}
      </span>
    )
  }

  return (
    <div
      title={title}
      style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.4 }}
    >
      <span aria-hidden style={{ fontSize: 10, opacity: 0.8 }}>📊</span>
      <span>
        {typical.onTime
          ? t('typicallyOnTime', line, slot)
          : t('typicallyLate', line, fmtDelay(typical.median), slot)}
      </span>
    </div>
  )
}

/**
 * Fuller breakdown for a detail view: the typical figure plus the bad-day p90
 * and the sample size, so the number is legible as a statistic rather than a
 * prediction. Also renders nothing without usable history.
 */
export function ReliabilityCard({ line, minuteOfDay, lineColors }: {
  line: string
  minuteOfDay: number
  lineColors?: Record<string, string>
}) {
  const { t } = useI18n()
  const stats = useReliability([line])
  const typical: Typical | null = typicalAt(stats[line], minuteOfDay, dayTypeOf(new Date()))
  if (!typical) return null

  const color = typical.onTime ? 'var(--green)' : 'var(--yellow)'
  const lineColor = lineColors?.[line] || LINE_COLORS[line] || 'var(--muted)'

  return (
    <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 10, marginBottom: 14, borderLeft: `3px solid ${lineColor}` }}>
      <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>
        {t('historyTitle')} · {fmtSlot(minuteOfDay)}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
        {typical.onTime ? t('typicalShortOnTime') : t('typicalShortLate', fmtDelay(typical.median))}
      </div>
      {!typical.onTime && typical.p90 > typical.median && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
          {t('worstCase', fmtDelay(typical.p90))}
        </div>
      )}
      <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 5, opacity: 0.8 }}>
        {t('basedOnHistory', typical.samples)}
      </div>
    </div>
  )
}

/** Reliability for "right now" — used where no specific time is in play. */
export function ReliabilityNow(props: Omit<Props, 'minuteOfDay'>) {
  return <ReliabilityNote {...props} minuteOfDay={minutesOfDay(new Date())} />
}
