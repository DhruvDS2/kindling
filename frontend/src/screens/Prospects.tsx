import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTop10Prospects, notifySlack } from '../api';
import { useAsOf, usePql } from '../asOf';
import { fmtDay } from '../nav';
import type { PqlScore } from '../types';
import type { TopProspect } from '../api';
import { SkeletonCard } from '../components/Skeleton';

function gmailUrl(email: string, subject: string, body: string) {
  return (
    'https://mail.google.com/mail/?view=cm&fs=1' +
    `&to=${encodeURIComponent(email)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`
  );
}

function buildEmailDraft(school: PqlScore) {
  const first = school.contact_name?.split(' ')[0] ?? 'there';
  if (school.pql_score === 0) {
    return {
      subject: `Getting started at ${school.name}`,
      body:
        `Hi ${first},\n\n` +
        `${school.name} signed up for Kindling a little while back and I wanted to reach out personally. ` +
        `Getting a new platform off the ground is always a lift, and I want to make sure you're not stuck on anything.\n\n` +
        `We've helped schools like yours get their first teachers up and running quickly, ` +
        `and I'd love to do the same for you. Even a short call to walk through the setup together can make a big difference.\n\n` +
        `Would that be useful? Happy to work around your calendar.\n\nBest,`,
    };
  }
  return {
    subject: `How's ${school.name} finding the platform?`,
    body:
      `Hi ${first},\n\n` +
      `Wanted to check in on how things are going at ${school.name}. ` +
      `I can see ${school.active_teachers} teacher${school.active_teachers !== 1 ? 's' : ''} have been exploring the platform ` +
      `and wanted to make sure the team is getting what they need.\n\n` +
      `Is there anything that's gotten in the way of wider adoption? Or a better time of year to reconnect?\n\n` +
      `Happy to jump on a quick call — no agenda, just want to make sure ${school.name} is set up for success.\n\nBest,`,
  };
}

const CHANNELS = [
  { key: 'slack',    label: 'Slack',       bg: '#4A154B', color: '#fff' },
  { key: 'gmail',    label: 'Gmail',       bg: '#EA4335', color: '#fff' },
  { key: 'linkedin', label: 'LinkedIn',    bg: '#0A66C2', color: '#fff' },
  { key: 'twitter',  label: 'X / Twitter', bg: '#000',    color: '#fff' },
];

function OutreachBar({ school }: { school: PqlScore }) {
  const { asOf } = useAsOf();
  const [slackState, setSlackState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const draft = buildEmailDraft(school);

  async function sendSlack() {
    setSlackState('sending');
    try {
      const res = await notifySlack('sales', school.school_id, asOf);
      setSlackState(res.ok ? 'sent' : 'error');
    } catch {
      setSlackState('error');
    }
  }

  const actions: Record<string, { href?: string; onClick?: () => void; label?: string }> = {
    slack: {
      label: slackState === 'sending' ? 'Sending…' : slackState === 'sent' ? '✓ Sent' : slackState === 'error' ? 'Failed — retry' : 'Slack',
      onClick: slackState !== 'sending' && slackState !== 'sent' ? sendSlack : undefined,
    },
    gmail: { href: gmailUrl(school.contact_email ?? '', draft.subject, draft.body) },
    linkedin: { href: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent((school.contact_name ?? '') + ' ' + school.name)}` },
    twitter: { href: `https://x.com/search?q=${encodeURIComponent(school.name)}` },
  };

  return (
    <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--row-divider)', background: 'var(--nav)' }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
        {school.contact_name
          ? `${school.contact_name} · ${school.contact_title} · ${school.contact_email}`
          : 'No contact on file — find one before reaching out'}
        <span style={{ color: 'var(--line)', margin: '0 8px' }}>·</span>
        <span style={{ fontStyle: 'italic', color: 'var(--muted)' }}>In production these open the native app or CRM integration</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {CHANNELS.map(ch => {
          const a = actions[ch.key];
          const isSent = ch.key === 'slack' && slackState === 'sent';
          const isError = ch.key === 'slack' && slackState === 'error';
          const bg = isSent ? 'var(--steady)' : isError ? 'var(--risk)' : ch.bg;
          const Tag = a.href ? 'a' : 'button';
          return (
            <Tag
              key={ch.key}
              {...(a.href ? { href: a.href, target: '_blank', rel: 'noopener noreferrer' } : {})}
              onClick={a.onClick}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                background: bg, color: ch.color, border: 'none', cursor: 'pointer',
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                opacity: ch.key === 'slack' && slackState === 'sending' ? 0.6 : 1,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {a.label ?? ch.label}
            </Tag>
          );
        })}
      </div>
    </div>
  );
}

function PriorityScore({ score }: { score: number }) {
  return (
    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
      {score}
    </span>
  );
}

/** The signals the API scored, each with the points it awarded, highest first. */
function rankedBy(prospects: TopProspect[]): string {
  const pts = new Map<string, number>();
  for (const p of prospects) for (const s of p.signals) {
    if (s.pts > 0) pts.set(s.label, Math.max(pts.get(s.label) ?? 0, s.pts));
  }
  return [...pts].sort((a, b) => b[1] - a[1]).map(([label, n]) => `${label} (${n} pts)`).join(' · ');
}

function Top10({ prospects, total, asOf }: { prospects: TopProspect[]; total: number; asOf: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [signalsOpen, setSignalsOpen] = useState<string | null>(null);
  const ranked = rankedBy(prospects);

  return (
    <div data-testid="prospects-top" style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--row-divider)' }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>
          Top {prospects.length} of {total} prospects · highest priority to pursue
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
          {ranked ? `Priority adds up the points for: ${ranked}` : 'No prospect has a scoring signal yet.'}
        </div>
      </div>
      {prospects.length === 0 && (
        <div style={{ padding: '28px 20px', color: 'var(--muted)', fontSize: 14 }}>
          No cold or dormant free schools on {fmtDay(asOf)}.
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--row-divider)' }}>
            {['#', 'School', 'State', 'Priority', 'Why', 'PQL', 'Contact'].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, color: 'var(--muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {prospects.map((school, i) => {
            const isOpen = expanded === school.school_id;
            const sigOpen = signalsOpen === school.school_id;
            const positiveSignals = school.signals.filter(s => s.pts > 0);
            return (
              <Fragment key={school.school_id}>
                <tr
                  onClick={() => setExpanded(isOpen ? null : school.school_id)}
                  style={{
                    borderBottom: '1px solid var(--row-divider)', cursor: 'pointer',
                    background: isOpen ? 'var(--nav)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'var(--nav)'; }}
                  onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {i + 1}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{school.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
                      {school.type === 'district' ? 'District' : 'Independent'}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--body)' }}>{school.state}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <PriorityScore score={school.priority_score} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={e => { e.stopPropagation(); setSignalsOpen(sigOpen ? null : school.school_id); }}
                      style={{
                        background: 'none', border: '1px solid var(--line)', borderRadius: 6,
                        padding: '3px 8px', fontSize: 12, color: 'var(--muted)', cursor: 'pointer',
                      }}
                    >
                      {positiveSignals.length} signal{positiveSignals.length !== 1 ? 's' : ''} {sigOpen ? '↑' : '↓'}
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)' }}>
                    {school.pql_score}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, color: 'var(--ink)' }}>{school.contact_name ?? '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{school.contact_title ?? ''}</div>
                  </td>
                </tr>
                {sigOpen && (
                  <tr>
                    <td colSpan={7} style={{ padding: 0 }}>
                      <div style={{ background: 'var(--nav)', padding: '10px 20px 12px', borderBottom: '1px solid var(--row-divider)' }}>
                        {school.signals.map((sig, j) => (
                          <div key={`${j}-${sig.label}`} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace',
                              color: sig.pts > 0 ? 'var(--ember)' : 'var(--muted)',
                              minWidth: 42,
                            }}>
                              {sig.pts > 0 ? `+${sig.pts}` : String(sig.pts)}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: sig.pts > 0 ? 'var(--ink)' : 'var(--muted)' }}>
                              {sig.label}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{sig.detail}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
                {isOpen && (
                  <tr>
                    <td colSpan={7} style={{ padding: 0 }}>
                      <OutreachBar school={school} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SchoolGroup({ title, subtitle, schools }: { title: string; subtitle: string; schools: PqlScore[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (schools.length === 0) return null;
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--row-divider)' }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--row-divider)' }}>
            {['School', 'State', 'PQL', 'Teachers', 'Sessions', 'Contact'].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schools.map((school) => {
            const isOpen = expanded === school.school_id;
            return (
              <Fragment key={school.school_id}>
                <tr
                  onClick={() => setExpanded(isOpen ? null : school.school_id)}
                  style={{ borderBottom: '1px solid var(--row-divider)', cursor: 'pointer', background: isOpen ? 'var(--nav)' : 'transparent' }}
                  onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'var(--nav)'; }}
                  onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{school.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{school.type === 'district' ? 'District' : 'Independent'}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--body)' }}>{school.state}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)' }}>{school.pql_score}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: 'var(--body)' }}>{school.active_teachers}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: 'var(--body)' }}>{school.student_sessions.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, color: 'var(--ink)' }}>{school.contact_name ?? '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{school.contact_title ?? ''}</div>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <OutreachBar school={school} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// /prospects/top10 treats free schools scoring under this as prospects (api.py, prospects_top10).
// It only splits the lists below and is never printed.
const PROSPECT_CUT = 20;

export default function Prospects() {
  const { asOf } = useAsOf();
  const { data: pqlData, isLoading: pqlLoading, error: pqlError } = usePql();
  const top = useQuery({ queryKey: ['prospects-top10', asOf], queryFn: () => fetchTop10Prospects(asOf) });

  if (pqlError) return <div style={{ color: 'var(--muted)' }}>Failed to load — is the API running?</div>;
  if (pqlLoading || top.isLoading) return <SkeletonCard rows={8} />;

  const cold    = (pqlData ?? []).filter(s => s.pql_score === 0);
  const dormant = (pqlData ?? []).filter(s => s.pql_score > 0 && s.pql_score < PROSPECT_CUT);
  const top10   = top.data?.top10 ?? [];
  const top10Ids = new Set(top10.map(s => s.school_id));

  // remaining schools not in the top list
  const coldRest    = cold.filter(s => !top10Ids.has(s.school_id));
  const dormantRest = dormant.filter(s => !top10Ids.has(s.school_id));

  return (
    <>
      {top.error ? (
        <div role="alert" style={{
          background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 20,
          marginBottom: 20, color: 'var(--muted)', fontSize: 14,
        }}>
          Couldn't load the top prospects for {fmtDay(asOf)}: {(top.error as Error).message}
        </div>
      ) : (
        <Top10 prospects={top10} total={top.data?.total_prospects ?? top10.length} asOf={asOf} />
      )}
      <SchoolGroup
        title="Cold · no activity"
        subtitle={`${coldRest.length} more school${coldRest.length === 1 ? '' : 's'}: signed up but zero teacher or student activity`}
        schools={coldRest}
      />
      <SchoolGroup
        title="Dormant · minimal activity"
        subtitle={`${dormantRest.length} more school${dormantRest.length === 1 ? '' : 's'}: some activity but not gaining traction`}
        schools={dormantRest}
      />
    </>
  );
}
