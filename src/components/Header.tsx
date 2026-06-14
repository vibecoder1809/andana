'use client'

interface HeaderProps {
  trainCount: number
  lineCount: number
  lastUpdate: Date | null
  refreshing: boolean
  onThemeToggle: () => void
  onRefresh: () => void
}

export function Header({ trainCount, lineCount, lastUpdate, refreshing, onThemeToggle, onRefresh }: HeaderProps) {
  const timeStr = lastUpdate
    ? lastUpdate.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  return (
    <header style={{
      gridColumn: '1 / -1',
      background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 16,
      zIndex: 10,
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ fontFamily: 'var(--font-space-grotesk), sans-serif', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse-dot 2s infinite' }} />
        Geotren
      </div>

      {/* Live badge */}
      <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: 'var(--green)', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }} />
        En viu
      </div>

      {/* Stats */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 20, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          <b style={{ color: 'var(--text)', fontSize: 13 }}>{trainCount}</b> trens
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          <b style={{ color: 'var(--text)', fontSize: 13 }}>{lineCount}</b> línies
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          Act. <b style={{ color: 'var(--text)', fontSize: 13 }}>{timeStr}</b>
        </span>
        <button onClick={onThemeToggle} style={{ background: 'none', border: '1px solid var(--border2)', color: 'var(--muted)', padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
          Tema
        </button>
        <button onClick={onRefresh} disabled={refreshing} style={{ background: 'none', border: '1px solid var(--border2)', color: refreshing ? 'var(--accent)' : 'var(--muted)', padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', opacity: refreshing ? 0.7 : 1 }}>
          {refreshing ? 'Carregant…' : 'Refresca'}
        </button>
      </div>
    </header>
  )
}
