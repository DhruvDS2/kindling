// Small building blocks shared by the school detail drawer.
import type { CSSProperties, ReactNode } from 'react';
import { SkeletonBlock } from '../Skeleton';
import { MONO } from './scale';

export function Section({ title, aside, children, testId }: { title: string; aside?: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <section data-testid={testId} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function SectionSkeleton({ height = 160 }: { height?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-busy="true">
      <SkeletonBlock height={height} />
      <SkeletonBlock height={12} width="60%" />
    </div>
  );
}

export function SectionError({ what, error, onRetry }: { what: string; error: unknown; onRetry: () => void }) {
  return (
    <div role="alert" style={{
      padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13,
      color: 'var(--body)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    }}>
      <span>Couldn’t load {what}: {error instanceof Error ? error.message : String(error)}</span>
      <button onClick={onRetry} style={{
        fontSize: 12, padding: '4px 10px', border: '1px solid var(--line)', borderRadius: 6,
        background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer', flexShrink: 0,
      }}>Retry</button>
    </div>
  );
}

export function Note({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--muted)', ...style }}>{children}</p>;
}

/** Legend key: a short swatch beside a text-token label (text never wears the series color). */
export function Key({ swatch, children }: { swatch: CSSProperties; children: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
      <span aria-hidden style={{ display: 'inline-block', width: 14, height: 8, borderRadius: 2, flexShrink: 0, ...swatch }} />
      {children}
    </span>
  );
}

export function Toggle<T extends string>({ value, options, onChange, label }: {
  value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="group" aria-label={label} style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
      {options.map(o => (
        <button key={o.id} onClick={() => onChange(o.id)} aria-pressed={value === o.id}
          style={{
            fontSize: 12, padding: '3px 10px', border: 'none', cursor: 'pointer', fontFamily: 'Inter',
            background: value === o.id ? 'var(--ink)' : 'var(--card)',
            color: value === o.id ? 'var(--paper)' : 'var(--muted)',
          }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Hover card for a chart. x is the pointer's x inside a chart of the given width. */
export function ChartTip({ x, y = 8, width, children }: { x: number; y?: number; width: number; children: ReactNode }) {
  const w = 190;
  const left = x + 14 + w > width ? Math.max(0, x - 14 - w) : x + 14;
  return (
    <div role="tooltip" style={{
      position: 'absolute', left, top: y, width: w, pointerEvents: 'none', zIndex: 2,
      background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8,
      boxShadow: '0 4px 14px rgba(28,27,25,0.08)', padding: '8px 10px', fontSize: 12, lineHeight: 1.5, color: 'var(--body)',
    }}>
      {children}
    </div>
  );
}

export function TipRow({ label, value, swatch }: { label: string; value: ReactNode; swatch?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
        {swatch && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: swatch }} />}
        {label}
      </span>
      <span style={{ fontFamily: MONO, color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}
