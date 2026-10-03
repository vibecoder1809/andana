import type { Lang, TransKey } from './i18n'

export interface FormattedAlertTime {
  /** Full human-readable date & time, e.g. "Avui a les 03:01" or "03/10/2026 a les 03:01" */
  full: string
  /** Time string e.g. "03:01" */
  time: string
  /** Date string e.g. "03/10/2026" */
  date: string
  /** Short compact label suitable for tickers e.g. "03:01" or "03/10 03:01" */
  compact: string
}

export function formatAlertDateTime(
  epochSeconds: number | undefined | null,
  lang: Lang,
  t: (key: TransKey, ...args: (string | number)[]) => string,
): FormattedAlertTime | null {
  if (!epochSeconds) return null
  const d = new Date(epochSeconds * 1000)
  if (isNaN(d.getTime())) return null

  const locale = lang === 'en' ? 'en-GB' : lang === 'es' ? 'es-ES' : 'ca-ES'
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })
  const date = d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const shortDate = d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })

  const now = new Date()
  const isSameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()

  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const isTomorrow =
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear()

  let full: string
  let compact: string
  if (isSameDay) {
    full = t('todayAt', time)
    compact = time
  } else if (isYesterday) {
    full = t('yesterdayAt', time)
    compact = `${shortDate} ${time}`
  } else if (isTomorrow) {
    full = t('tomorrowAt', time)
    compact = `${shortDate} ${time}`
  } else {
    full = t('dateTimeAt', date, time)
    compact = `${shortDate} ${time}`
  }

  return { full, time, date, compact }
}
