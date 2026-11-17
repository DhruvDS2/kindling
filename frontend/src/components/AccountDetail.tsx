import { useState } from 'react';
import type { PqlScore, HealthScore } from '../types';
import ScoreChip from './ScoreChip';
import { notifySlack } from '../api';

type School = PqlScore | HealthScore;

function isHealth(s: School): s is HealthScore {
  return 'health_score' in s;
}

const SIGNAL_DATES = ['Jan 26', 'Jan 5', 'Dec 1', 'Aug 18'];

interface Props {
  type: 'pql' | 'health';
  school: School;
  onClose: () => void;
}

export default function AccountDetail({ type, school, onClose }: Props) {
  const [slackSent, setSlackSent] = useState(false);
  const [slackLoading, setSlackLoading] = useState(false);
  const [contacted, setContacted] = useState(false);

  const hs = isHealth(school) ? school : null;
  const score = type === 'health' && hs ? hs.health_score : (school as PqlScore).pql_score;

  const renewLabel = hs
    ? new Date(Date.now() + hs.days_to_renewal * 86400000)
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const handleSlack = async () => {
    setSlackLoading(true);
    try {
      await notifySlack('cs', school.school_id);
      setSlackSent(true);
    } catch {
      // proceed optimistically — Slack webhook may not be configured
      setSlackSent(true);
    } finally {
      setSlackLoading(false);
    }
  };

  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(school.contact_email)}&su=${encodeURIComponent(`Checking in on ${school.name}`)}&body=${encodeURIComponent(`Hi ${school.contact_name.split(' ')[0]},\n\nJust wanted to check in on how things are going at ${school.name}.\n\nWould love to hear how the team is finding the platform.\n\nBest,`)}`;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.15)',
          zIndex: 40,
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 420,
        background: 'var(--card)',
        zIndex: 50,
        padding: 24,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
              {school.district ? 'District' : 'Independent'} · {school.state} · {hs ? hs.seats : '—'} seats
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ink)', fontFamily: 'Inter' }}>
              {school.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--line)',
              borderRadius: 6,
              cursor: 'pointer',
              padding: '4px 8px',
              fontSize: 16,
              color: 'var(--muted)',
              flexShrink: 0,
              marginLeft: 12,
            }}
          >
            ×
          </button>
        </div>

        {/* Score + renewal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <ScoreChip score={score} type={type} />
          {hs && (
            <span style={{ fontSize: 14, color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace' }}>
              Renews {renewLabel} · in {hs.days_to_renewal} days
            </span>
          )}
        </div>
        {hs && (
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginTop: -12 }}>
            ${hs.arr.toLocaleString()} ARR
          </div>
        )}

        {/* Chart placeholder */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
            Active teachers per week
          </div>
          <div style={{
            height: 200,
            background: 'var(--nav)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: 'var(--muted)',
            fontStyle: 'italic',
          }}>
            {/* TODO: add per-week teacher activity endpoint to API */}
            Weekly activity chart coming soon
          </div>
        </div>

        {/* Why at risk */}
        {school.reasons.length > 0 && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
              Why it's {type === 'health' ? 'at risk' : 'ready'}
            </div>
            <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {school.reasons.slice(0, 3).map((r, i) => (
                <li key={i} style={{ fontSize: 14, color: 'var(--body)', lineHeight: 1.5 }}>{r}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Signals */}
        {school.reasons.length > 0 && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>Signals</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {school.reasons.slice(0, 4).map((reason, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <span style={{
                    fontSize: 13,
                    color: 'var(--muted)',
                    fontFamily: 'JetBrains Mono, monospace',
                    whiteSpace: 'nowrap',
                    minWidth: 48,
                  }}>
                    {SIGNAL_DATES[i] ?? ''}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--body)', lineHeight: 1.5 }}>{reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={handleSlack}
            disabled={slackSent || slackLoading}
            style={{
              height: 44,
              width: '100%',
              background: slackSent ? 'var(--steady)' : 'var(--ink)',
              color: 'var(--paper)',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: slackSent ? 'default' : 'pointer',
              fontFamily: 'Inter',
            }}
          >
            {slackSent ? '✓ Sent to #cs-alerts' : slackLoading ? 'Sending…' : 'Send to #cs-alerts'}
          </button>

          <a
            href={gmailUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              height: 44,
              width: '100%',
              background: 'transparent',
              color: 'var(--ink)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'Inter',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
            }}
          >
            Draft check-in email
          </a>

          <button
            onClick={() => setContacted(v => !v)}
            style={{
              height: 44,
              width: '100%',
              background: 'transparent',
              color: contacted ? 'var(--steady)' : 'var(--ink)',
              border: `1px solid ${contacted ? 'var(--steady)' : 'var(--line)'}`,
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'Inter',
            }}
          >
            {contacted ? '✓ Marked contacted' : 'Mark contacted'}
          </button>
        </div>
      </div>
    </>
  );
}
