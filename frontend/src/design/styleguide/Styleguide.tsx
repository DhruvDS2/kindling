// /__styleguide (dev only; main.tsx never imports this in a production build).
// Every base component in every state, on SAMPLE data, in light and dark.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Button, Drawer, DrawerSection, EmptyState, ErrorState, Kbd, Nav, NumberFlow, PageView, PropertyList,
  ScoreMeter, SearchField, SegmentedControl, Skeleton, Sparkline, StatBlock, StatRow, StatusPill, Table, Tabs,
  ToastProvider, Tooltip, TopBar, TruncatedText, UpdatingMark, WeekPager, WeekRuler, fmtShort, fmtWeek, icons, statusTone,
  readToken, usePageTransition, useToast, type Column, type RowAction, type StatusTone,
} from '../index';
import {
  SAMPLE_BREAKS, SAMPLE_DEMO_DATE, SAMPLE_MONDAYS, SAMPLE_NEXT_WEEK, SAMPLE_PREV_WEEK, SAMPLE_READY_LINE, SAMPLE_SCHOOLS, SAMPLE_STATS,
  type SampleSchool,
} from './sample';
import './styleguide.css';

type Theme = 'system' | 'light' | 'dark';

function applyTheme(t: Theme) {
  const html = document.documentElement;
  if (t === 'system') delete html.dataset.theme; else html.dataset.theme = t;
}

const SECTIONS = [
  ['tokens', 'Tokens'], ['shell', 'AppShell + Nav'], ['buttons', 'Button'], ['choices', 'Tabs, SegmentedControl'],
  ['status', 'StatusPill, ScoreMeter'], ['numbers', 'NumberFlow, StatBlock, StatRow'], ['table', 'Table'],
  ['drawer', 'Drawer, PropertyList'], ['date', 'DateControl'], ['feedback', 'Feedback states'], ['pages', 'PageTransition'],
] as const;

export default function Styleguide() {
  const [theme, setTheme] = useState<Theme>(() => {
    const q = new URLSearchParams(window.location.search).get('theme');
    return q === 'dark' || q === 'light' ? q : 'system';
  });
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => { document.title = 'Kindling · styleguide (dev)'; }, []);
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <ToastProvider>
      <div className="sg">
        <aside className="sg__index">
          <div className="sg__index-inner">
            <div className="sg__brand"><span className="sg__mark" aria-hidden="true" />Kindling</div>
            <p className="sg__index-note">Base components · dev only</p>
            <nav aria-label="Styleguide sections">
              {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className="sg__index-link k-focus">{label}</a>)}
            </nav>
          </div>
        </aside>
        <main className="sg__main">
          <header className="sg__head">
            <div>
              <h1 className="k-display">Base components</h1>
              <p className="sg__lede">
                Every Phase 1 component in every state. All numbers and names on this page are <strong>sample data</strong>;
                the product reads every number from the API at runtime.
              </p>
            </div>
            <div className="sg__controls">
              <SegmentedControl
                aria-label="Theme"
                value={theme}
                onChange={setTheme}
                options={[{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'system', label: 'System' }]}
              />
            </div>
          </header>
          <p className="sg__note" data-testid="motion-note">
            Reduced motion is <strong>{reduced ? 'on' : 'off'}</strong> on this device. When it's on, nothing moves or clips:
            the drawer and toasts fade, numbers swap instantly, rows don't slide or stagger, and skeletons hold still.
          </p>

          <TokensSection />
          <ShellSection />
          <ButtonsSection />
          <ChoicesSection />
          <StatusSection />
          <NumbersSection />
          <TableSection />
          <DrawerDemoSection />
          <DateSection />
          <FeedbackSection />
          <PagesSection />
        </main>
      </div>
    </ToastProvider>
  );
}

function Section({ id, title, refs, children }: { id: string; title: string; refs: string; children: ReactNode }) {
  return (
    <section id={id} className="sg__section">
      <div className="sg__section-head">
        <h2 className="sg__section-title">{title}</h2>
        <span className="sg__refs">{refs}</span>
      </div>
      {children}
    </section>
  );
}

function Spec({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <figure className={['sg__spec', wide ? 'is-wide' : ''].join(' ').trim()}>
      <figcaption className="sg__spec-label">{label}</figcaption>
      <div className="sg__spec-body">{children}</div>
    </figure>
  );
}

/* ── Tokens ─────────────────────────────────────────────────────────── */
const COLOR_GROUPS: [string, string[]][] = [
  ['Background', ['bg-page', 'bg-subtle', 'bg-surface', 'bg-raised', 'bg-hover', 'bg-press']],
  ['Text', ['text-primary', 'text-secondary', 'text-tertiary', 'text-disabled']],
  ['Lines', ['border-faint', 'border-hairline', 'border-strong']],
  ['Accent (ember)', ['accent', 'accent-strong', 'accent-subtle']],
  ['Status', ['status-ready-fg', 'status-risk-fg', 'status-healthy-fg', 'status-neutral-fg', 'status-ready-bg', 'status-risk-bg', 'status-healthy-bg', 'status-neutral-bg']],
  ['Data', ['data-naive', 'data-break', 'data-summer']],
];

function TokensSection() {
  return (
    <Section id="tokens" title="Tokens" refs="tokens.css · DESIGN.md §4–§5">
      <div className="sg__colors">
        {COLOR_GROUPS.map(([group, names]) => (
          <div key={group} className="sg__color-group">
            <div className="sg__spec-label">{group}</div>
            {names.map(n => (
              <div key={n} className="sg__color">
                <span className="sg__swatch" style={{ background: `var(--${n})` }} />
                <code className="k-mono">--{n}</code>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="sg__grid">
        <Spec label="Type scale (Inter; one display size, three text sizes, a label size)" wide>
          <div className="sg__type">
            <div className="k-display">9 schools ready to buy · 28/32 · 500</div>
            <div className="k-text-lg k-medium">Why it's at risk · 16/24 · 500</div>
            <div className="k-text-md">Active teachers down 67% vs the prior window · 14/20 · 400</div>
            <div className="k-text-sm k-secondary">Independent · Milwaukee, WI · 13/18 · 400</div>
            <div className="k-text-label k-tertiary"><strong className="sg__th">Days to renewal</strong> · 12/16 · 600 for table headers only</div>
            <div className="k-text-sm k-tertiary">IDs and hashes only in mono: <span className="k-mono">814a258</span> · <span className="k-mono">S-1042</span></div>
          </div>
        </Spec>
        <Spec label="Space: multiples of --space-1, plus the --space-0-5 half-step">
          <div className="sg__space">
            {['0-5', '1', '1-5', '2', '3', '4', '5', '6', '8'].map(s => (
              <div key={s} className="sg__space-row"><code className="k-mono">--space-{s} · {readToken(`--space-${s}`)}</code><span style={{ width: `var(--space-${s})` }} /></div>
            ))}
          </div>
        </Spec>
        <Spec label="Radius (tables and panels square)">
          <div className="sg__radii">
            {['0', '1', '2', '3'].map(r => <span key={r} style={{ borderRadius: `var(--radius-${r})` }}><code className="k-mono">{r}</code></span>)}
          </div>
        </Spec>
        <Spec label="Motion (DESIGN.md §4)">
          <dl className="sg__motion">
            {([
              ['--motion-fast', 'hover, press'], ['--motion-base', 'state, number count, close'],
              ['--motion-slow', 'panels, pages, row reorder'], ['--motion-reveal', 'first-load reveals, once'],
              ['--ease-enter', 'anything appearing or moving in'], ['--ease-exit', 'anything leaving'],
            ] as const).map(([name, use]) => (
              <div key={name} className="sg__motion-row">
                <dt><code className="k-mono">{name}</code></dt>
                <dd><span className="k-num">{readToken(name)}</span> · {use}</dd>
              </div>
            ))}
          </dl>
        </Spec>
        <Spec label="Elevation: popovers only (the drawer has none)">
          <div className="sg__elev">Popover · <code className="k-mono">--elevation-popover</code></div>
        </Spec>
      </div>
    </Section>
  );
}

/* ── Shell ──────────────────────────────────────────────────────────── */
function ShellSection() {
  const [active, setActive] = useState('ready');
  const [week, setWeek] = useState(SAMPLE_DEMO_DATE);
  const [updating, setUpdating] = useState(false);
  const step = (w: string) => { setWeek(w); setUpdating(true); window.setTimeout(() => setUpdating(false), 900); };
  return (
    <Section id="shell" title="AppShell + Nav" refs="1A grouped sidebar · 8A travelling hover (Linear 9627d9b8…)">
      <div className="sg__shell">
        <Nav
          activeId={active}
          onSelect={setActive}
          brand={<><span className="sg__mark" aria-hidden="true" />Kindling</>}
          groups={[
            { id: 'daily', items: [{ id: 'brief', label: 'Monday brief' }, { id: 'ready', label: 'Ready to buy', count: 9 }, { id: 'risk', label: 'At risk', count: 4 }] },
            { id: 'more', label: 'Pipeline and proof', items: [
              { id: 'pipeline', label: 'Pipeline' }, { id: 'prospects', label: 'Prospects', count: 0 },
              { id: 'backtest', label: 'Backtest' }, { id: 'automations', label: 'Automations and alert runs from n8n', count: 1 },
            ] },
          ]}
          footer={<>Alerts sent Nov 17 (n8n)</>}
        />
        <div className="sg__shell-main">
          <TopBar
            title="Ready to buy"
            subtitle={`${fmtWeek(week).replace(/^\w+, /, '')}: 9 of 85 free schools are ready this week.`}
            actions={<><UpdatingMark active={updating} /><WeekPager value={week} min="2025-08-01" max="2026-07-31" demoDate={SAMPLE_DEMO_DATE} onChange={step} /></>}
          />
          <p className="sg__hint">Hover the sidebar: one highlight travels between items. "Prospects 0" and a long label show the edge cases. Step the week to see the quiet "Updating…".</p>
        </div>
      </div>
      <div className="sg__grid">
        <Spec label="Nav item states">
          <div className="sg__navstates">
            <button type="button" className="k-nav__item"><span className="k-nav__label">Default</span></button>
            <button type="button" className="k-nav__item" data-force="hover"><span className="k-nav__label">Hover</span></button>
            <button type="button" className="k-nav__item k-focus" data-force="focus"><span className="k-nav__label">Focus (keyboard)</span></button>
            <button type="button" className="k-nav__item" data-force="active"><span className="k-nav__label">Press</span></button>
            <button type="button" className="k-nav__item is-active"><span className="k-nav__label">Active</span><span className="k-nav__count k-num">12</span></button>
          </div>
        </Spec>
      </div>
    </Section>
  );
}

/* ── Buttons ────────────────────────────────────────────────────────── */
function ButtonsSection() {
  const states: { label: string; props: Record<string, unknown> }[] = [
    { label: 'Default', props: {} }, { label: 'Hover', props: { force: 'hover' } }, { label: 'Focus', props: { force: 'focus' } },
    { label: 'Press', props: { force: 'active' } }, { label: 'Disabled', props: { disabled: true } }, { label: 'Loading', props: { loading: true } },
  ];
  return (
    <Section id="buttons" title="Button" refs="primary = the one AA-safe accent; secondary; quiet">
      <table className="sg__matrix">
        <thead><tr><th />{states.map(s => <th key={s.label}>{s.label}</th>)}</tr></thead>
        <tbody>
          {(['primary', 'secondary', 'quiet'] as const).map(v => (
            <tr key={v}>
              <th scope="row">{v}</th>
              {states.map(s => (
                <td key={s.label}>
                  <Button variant={v} {...s.props}>{v === 'primary' ? 'Send to #sales' : v === 'secondary' ? 'Mark contacted' : 'Copy email'}</Button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sg__row">
        <Button size="sm" variant="secondary" icon={<icons.ChevronLeft />} aria-label="Previous" />
        <Button size="sm" variant="quiet" iconAfter={<icons.ArrowRight />}>Next school</Button>
        <Button size="sm" variant="quiet" shortcut="C">Copy email</Button>
        <Button variant="secondary" className="sg__long-btn">Send the renewal summary to #customer-success-escalations</Button>
        <span className="k-text-sm k-tertiary">Keys: <Kbd>j</Kbd> <Kbd>k</Kbd> <Kbd>↵</Kbd> <Kbd>/</Kbd></span>
      </div>
    </Section>
  );
}

/* ── Tabs / Segmented ───────────────────────────────────────────────── */
function ChoicesSection() {
  const [tab, setTab] = useState('school');
  const [seg, setSeg] = useState('ready');
  return (
    <Section id="choices" title="Tabs, SegmentedControl" refs="indicator moves with layoutId over --motion-base">
      <div className="sg__grid">
        <Spec label="Tabs (arrow keys move)">
          <Tabs aria-label="Usage view" value={tab} onChange={setTab}
            options={[{ id: 'school', label: 'School days' }, { id: 'calendar', label: 'Calendar days' }, { id: 'none', label: 'Day by day', disabled: true }]} />
        </Spec>
        <Spec label="SegmentedControl with counts (a filter)">
          <SegmentedControl aria-label="Filter" value={seg} onChange={setSeg}
            options={[{ id: 'ready', label: 'Ready', count: 9 }, { id: 'all', label: 'All', count: 85 }, { id: 'none', label: 'Archived', count: 0, disabled: true }]} />
        </Spec>
      </div>
    </Section>
  );
}

/* ── Status ─────────────────────────────────────────────────────────── */
function StatusSection() {
  const tones: [StatusTone, string][] = [['ready', 'Ready'], ['risk', 'At risk'], ['healthy', 'Healthy'], ['neutral', 'Not yet']];
  return (
    <Section id="status" title="StatusPill, ScoreMeter" refs="status color only for status; the word is always printed">
      <div className="sg__grid">
        <Spec label="StatusPill: every status has a word">
          <div className="sg__row">{tones.map(([t, w]) => <StatusPill key={t} tone={t}>{w}</StatusPill>)}</div>
        </Spec>
        <Spec label="ScoreMeter: threshold tick passed in (ready at 60, at risk below 70)">
          <div className="sg__stack">
            <ScoreMeter value={90} threshold={SAMPLE_READY_LINE} tone="ready" thresholdLabel="Ready at 60" />
            <ScoreMeter value={60} threshold={SAMPLE_READY_LINE} tone={statusTone('Ready')} thresholdLabel="Ready at 60" />
            <ScoreMeter value={41} threshold={SAMPLE_READY_LINE} tone="neutral" thresholdLabel="Ready at 60" />
            <ScoreMeter value={34} threshold={70} tone="risk" thresholdLabel="At risk below 70" />
            <ScoreMeter value={88} threshold={70} tone="healthy" thresholdLabel="At risk below 70" />
            <ScoreMeter value={0} threshold={70} tone="risk" thresholdLabel="At risk below 70" />
            <ScoreMeter value={100} threshold={SAMPLE_READY_LINE} tone="ready" showValue={false} thresholdLabel="Ready at 60" />
          </div>
        </Spec>
      </div>
    </Section>
  );
}

/* ── Numbers ────────────────────────────────────────────────────────── */
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const pct = (n: number) => `${n.toFixed(1)}%`;

function NumbersSection() {
  const [w, setW] = useState<1 | 2>(1);
  const weeks = [SAMPLE_PREV_WEEK, SAMPLE_DEMO_DATE, SAMPLE_NEXT_WEEK];
  return (
    <Section id="numbers" title="NumberFlow, StatBlock, StatRow" refs="7A count-through (Lassie 9fc27e0c…) · 3B · 3A">
      <div className="sg__row">
        <Button variant="secondary" size="sm" onClick={() => setW(w === 1 ? 2 : 1)} data-testid="sg-step-stats">
          {w === 1 ? `Step to ${fmtWeek(SAMPLE_NEXT_WEEK)}` : `Back to ${fmtWeek(SAMPLE_DEMO_DATE)}`}
        </Button>
        <span className="k-text-sm k-tertiary">Numbers count through over --motion-base; first load counts up once over --motion-reveal.</span>
      </div>
      <div className="sg__stats">
        {SAMPLE_STATS.map(s => {
          const v = s.values[w], prev = s.values[w - 1];
          const delta = v - prev;
          const fmt = s.money ? usd : s.percent ? pct : undefined;
          return (
            <StatBlock
              key={s.label}
              label={s.label}
              value={v}
              format={fmt}
              context={`${delta >= 0 ? '+' : '−'}${fmt ? fmt(Math.abs(delta)) : Math.abs(delta)} vs ${fmtShort(weeks[w - 1])}`}
              sparkline={<Sparkline values={[...s.trend.slice(w - 1), ...s.values.slice(1, w + 1)].slice(-8)} label={`${s.label}, last 8 Mondays`} />}
            />
          );
        })}
      </div>
      <div className="sg__grid">
        <Spec label="StatBlock · loading"><StatBlock label="Ready to buy" value={null} loading /></Spec>
        <Spec label="StatBlock · error"><StatBlock label="ARR at risk" value={null} error="Couldn't load /stats" /></Spec>
        <Spec label="StatBlock · no value yet"><StatBlock label="Pipeline moved" value={null} context="No earlier snapshot to compare" /></Spec>
        <Spec label="NumberFlow inline"><span className="k-text-md">There are <NumberFlow value={SAMPLE_STATS[0].values[w]} className="k-medium" /> schools ready this week.</span></Spec>
      </div>
      <Spec label="StatRow (3A): a ruled four-stat row, Kindling first, the naive model quiet" wide>
        <StatRow items={[
          { label: 'Precision', value: 77, format: n => `${Math.round(n)}%`, context: 'vs 37% for the naive model', emphasis: true },
          { label: 'Recall', value: 71, format: n => `${Math.round(n)}%`, context: 'vs 100% (naive wins here)' },
          { label: 'False alarms', value: 0, format: n => `${Math.round(n)}%`, context: 'vs 98% on healthy schools' },
          { label: 'Lead time', value: 28, format: n => `${Math.round(n)} d`, context: 'vs 56 days' },
        ]} />
      </Spec>
    </Section>
  );
}

/* ── Table ──────────────────────────────────────────────────────────── */
type Row = SampleSchool & { score: number; rank: number };

function rowsFor(week: 0 | 1): Row[] {
  return SAMPLE_SCHOOLS
    .map(s => ({ ...s, score: s.scores[week] }))
    .sort((a, b) => b.score - a.score)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

function useSchoolColumns(): Column<Row>[] {
  return useMemo(() => [
    { id: 'rank', header: '#', numeric: true, width: '6%', cell: r => <span className="k-tertiary">{r.rank}</span>, skeleton: '50%' },
    {
      id: 'school', header: 'School', width: '27%', sortValue: r => r.name, skeletonLines: 2, skeleton: '70%',
      cell: r => (
        <div className="sg__cell-2">
          <TruncatedText className="k-medium">{r.name}</TruncatedText>
          <TruncatedText className="k-text-sm k-tertiary">{r.place}</TruncatedText>
        </div>
      ),
    },
    {
      id: 'score', header: 'Score', width: '16%', sortValue: r => r.score, firstDirection: 'desc', skeleton: '80%',
      cell: r => <ScoreMeter value={r.score} threshold={SAMPLE_READY_LINE} tone={r.score >= SAMPLE_READY_LINE ? 'ready' : 'neutral'} thresholdLabel={`Ready at ${SAMPLE_READY_LINE}`} />,
    },
    {
      id: 'why', header: 'Why', skeleton: '85%',
      cell: r => <div className="sg__why"><span className="k-num k-tertiary">{r.points}</span><TruncatedText>{r.reason}</TruncatedText></div>,
    },
    { id: 'teachers', header: 'Teachers', numeric: true, width: '10%', sortValue: r => r.teachers, cell: r => r.teachers, skeleton: '40%' },
    {
      id: 'contact', header: 'Contact', width: '16%', skeletonLines: 2,
      cell: r => <div className="sg__cell-2"><TruncatedText>{r.contact}</TruncatedText><TruncatedText className="k-text-sm k-tertiary">{r.title}</TruncatedText></div>,
    },
  ], []);
}

function TableSection() {
  const toast = useToast();
  const columns = useSchoolColumns();
  const [week, setWeek] = useState<0 | 1>(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [tableKey, setTableKey] = useState(0);
  const [tint, setTint] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => { const t = window.setTimeout(() => setLoading(false), 1200); return () => window.clearTimeout(t); }, [tableKey]);

  const rows = useMemo(() => rowsFor(week).filter(r => r.name.toLowerCase().includes(query.toLowerCase())), [week, query]);
  const firstBelow = rows.find(r => r.score < SAMPLE_READY_LINE);
  const step = () => {
    const next = (1 - week) as 0 | 1;
    const crossed = SAMPLE_SCHOOLS.filter(s => (s.scores[week] >= SAMPLE_READY_LINE) !== (s.scores[next] >= SAMPLE_READY_LINE)).map(s => s.id);
    setWeek(next);
    setTint(new Set(crossed));
  };
  const actions = (r: Row): RowAction<Row>[] => [
    { id: 'open', label: 'Open', shortcut: 'Enter', onSelect: () => setOpen(r.id) },
    { id: 'copy', label: 'Copy email', shortcut: 'c', onSelect: () => toast({ message: `Copied ${r.email} (sample)`, tone: 'success' }) },
    { id: 'send', label: 'Send to Slack', shortcut: 's', onSelect: () => toast({ message: `Sample only: nothing was sent for ${r.name}.` }) },
  ];
  const all = rowsFor(week);
  const openIndex = open ? all.findIndex(r => r.id === open) : -1;

  return (
    <Section id="table" title="Table" refs="2A columns (Sui Y0VPNY27…) · 9A first load (Paradigm 274e851a…) · 8A hover · 8B row actions (Terminal ecSttagJ…)">
      <div className="sg__toolbar">
        <SearchField ref={search} value={query} onChange={setQuery} />
        <Button variant="secondary" size="sm" onClick={step} data-testid="sg-step-table">
          {week === 0 ? 'Step a week (rows reorder)' : 'Step back a week'}
        </Button>
        <Button variant="quiet" size="sm" onClick={() => { setLoading(true); setTableKey(k => k + 1); }}>Replay first load</Button>
        <span className="sg__keys k-text-sm k-tertiary"><Kbd>j</Kbd>/<Kbd>k</Kbd> move · <Kbd>↵</Kbd> open · <Kbd>c</Kbd> copy · <Kbd>s</Kbd> send · <Kbd>/</Kbd> search · <Kbd>Esc</Kbd> clear</span>
      </div>
      <div data-testid="sg-table">
        <Table
          key={tableKey}
          aria-label="Sample schools ready to buy"
          rows={loading ? [] : rows}
          loading={loading}
          skeletonRows={6}
          columns={columns}
          rowKey={r => r.id}
          rowLabel={r => r.name}
          onOpen={r => setOpen(r.id)}
          rowActions={actions}
          searchRef={search}
          selectedKey={open}
          tintKeys={tint}
          defaultSort={{ columnId: 'score', direction: 'desc' }}
          dividers={firstBelow ? [{ beforeKey: firstBelow.id, label: `Ready line · score ${SAMPLE_READY_LINE}` }] : []}
          empty={<EmptyState action={{ label: 'Clear search', onClick: () => setQuery('') }}>No sample school matches "{query}".</EmptyState>}
        />
      </div>
      <div className="sg__grid">
        <Spec label="Loading (first load only: skeletons shaped like rows)" wide>
          <Table aria-label="Loading example" rows={[] as Row[]} loading skeletonRows={3} columns={columns} rowKey={r => r.id} />
        </Spec>
        <Spec label="Empty (0 items): one sentence plus one action" wide>
          <Table aria-label="Empty example" rows={[] as Row[]} columns={columns} rowKey={r => r.id}
            empty={<EmptyState action={{ label: 'Show all 85 free schools', onClick: () => undefined }}>No school is ready to buy on Feb 2. Scores move every Monday.</EmptyState>} />
        </Spec>
        <Spec label="Error: what failed, plus retry" wide>
          <Table aria-label="Error example" rows={[] as Row[]} columns={columns} rowKey={r => r.id}
            error={<ErrorState title="Couldn't load readiness scores for Feb 2." detail="GET /pql?as_of=2026-02-02 → 503" onRetry={() => undefined} />} />
        </Spec>
        <Spec label="One item, long name truncated (hover or focus it for the full name), forced row hover showing the actions" wide>
          <Table aria-label="One row example" rows={rowsFor(0).filter(r => r.id === 'S-2210')} columns={columns} rowKey={r => r.id}
            rowLabel={r => r.name} rowActions={actions} forceHoverKey="S-2210" />
        </Spec>
      </div>
      <SchoolDrawer rows={all} index={openIndex} onIndex={i => setOpen(all[i]?.id ?? null)} onClose={() => setOpen(null)} />
    </Section>
  );
}

function SchoolDrawer({ rows, index, onIndex, onClose }: { rows: Row[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const toast = useToast();
  const r = rows[index];
  const [sending, setSending] = useState(false);
  return (
    <Drawer
      open={index >= 0 && !!r}
      onClose={onClose}
      title={r?.name ?? ''}
      contentKey={r?.id}
      meta={r && (
        <>
          <ScoreMeter value={r.score} threshold={SAMPLE_READY_LINE} tone={r.score >= SAMPLE_READY_LINE ? 'ready' : 'neutral'} thresholdLabel={`Ready at ${SAMPLE_READY_LINE}`} />
          <StatusPill tone={r.score >= SAMPLE_READY_LINE ? 'ready' : 'neutral'}>{r.score >= SAMPLE_READY_LINE ? 'Ready' : 'Not yet'}</StatusPill>
          <span>{r.place}</span>
        </>
      )}
      pager={{ index, total: rows.length, onPrev: () => onIndex(index - 1), onNext: () => onIndex(index + 1), label: 'sample schools' }}
      nextLink={index < rows.length - 1 ? { onClick: () => onIndex(index + 1) } : undefined}
      footer={
        <>
          <Button variant="primary" loading={sending} onClick={() => { setSending(true); window.setTimeout(() => { setSending(false); toast({ message: 'Sample only: nothing was sent.' }); }, 800); }}>
            Send to #sales
          </Button>
          <Button variant="secondary">Mark contacted</Button>
        </>
      }
    >
      {r && (
        <>
          <DrawerSection>
            <PropertyList items={[
              { label: 'Contact', value: `${r.contact} · ${r.title}` },
              { label: 'Email', value: r.email },
              { label: 'Type · location', value: r.place },
              { label: 'Active teachers', value: r.teachers, numeric: true },
              { label: 'Admin signed up', value: null },
              { label: 'School ID', value: <span className="k-mono">{r.id}</span> },
            ]} />
          </DrawerSection>
          <DrawerSection title="Why it's ready" aside="points">
            <div className="sg__why"><span className="k-num k-tertiary">{r.points}</span><span>{r.reason}</span></div>
          </DrawerSection>
          <DrawerSection title="Usage">
            <p className="k-text-sm k-tertiary">Lane C puts the usage chart (5A) here. Sample drawer: j/k or ↑/↓ steps through the list, Esc closes and returns focus to the row.</p>
          </DrawerSection>
        </>
      )}
    </Drawer>
  );
}

/* ── Drawer + PropertyList ──────────────────────────────────────────── */
function DrawerDemoSection() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const rows = rowsFor(0);
  return (
    <Section id="drawer" title="Drawer, PropertyList" refs="Preymaker d653fb44… motion adapted (§3.1) · 4A Playground dcdab50f… · 4C pager">
      <div className="sg__row">
        <Button variant="secondary" onClick={() => setOpen(true)} data-testid="sg-open-drawer">Open sample drawer</Button>
        <span className="k-text-sm k-tertiary">Opens with a right-side clip wipe over --motion-slow; closes over --motion-base. Reduced motion: fades only.</span>
      </div>
      <div className="sg__grid">
        <Spec label="PropertyList: long value truncates, empty shows a dash">
          <PropertyList title="Details" items={[
            { label: 'Renews', value: 'Mar 1, 2026 · in 27 days' },
            { label: 'ARR', value: '$5,600 · 14 seats', numeric: true },
            { label: 'Contact', value: 'Priya Natarajan-Whitfield · Assistant Principal, Curriculum & Instruction' },
            { label: 'District', value: null },
          ]} />
        </Spec>
      </div>
      <SchoolDrawerStandalone open={open} rows={rows} index={i} onIndex={setI} onClose={() => setOpen(false)} />
    </Section>
  );
}

function SchoolDrawerStandalone({ open, ...p }: { open: boolean; rows: Row[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  return <SchoolDrawer {...p} index={open ? p.index : -1} />;
}

/* ── Date control ───────────────────────────────────────────────────── */
function DateSection() {
  const [week, setWeek] = useState(SAMPLE_DEMO_DATE);
  const [scrub, setScrub] = useState<string | null>(null);
  const [settled, setSettled] = useState(0);
  return (
    <Section id="date" title="DateControl" refs="WeekPager · 10B WeekRuler (Eleken b136df2f…), §3.5">
      <div className="sg__row">
        <WeekPager value={scrub ?? week} min="2025-08-01" max="2026-07-31" demoDate={SAMPLE_DEMO_DATE} onChange={w => { setWeek(w); setScrub(null); setSettled(n => n + 1); }} />
        <span className="k-text-sm k-tertiary" data-testid="sg-settled">Settled changes: <span className="k-num">{settled}</span> · value {week}</span>
      </div>
      <WeekRuler
        mondays={SAMPLE_MONDAYS}
        value={week}
        current={SAMPLE_DEMO_DATE}
        breaks={SAMPLE_BREAKS}
        onScrub={setScrub}
        onChange={w => { setWeek(w); setScrub(null); setSettled(n => n + 1); }}
      />
      <div className="sg__grid">
        <Spec label="Pager at the first Monday (previous disabled)">
          <WeekPager value={SAMPLE_MONDAYS[0]} min="2025-08-01" max="2026-07-31" onChange={() => undefined} />
        </Spec>
        <Spec label="Disabled ruler">
          <WeekRuler mondays={SAMPLE_MONDAYS.slice(0, 20)} value={SAMPLE_MONDAYS[6]} onChange={() => undefined} disabled />
        </Spec>
      </div>
    </Section>
  );
}

/* ── Feedback ───────────────────────────────────────────────────────── */
function FeedbackSection() {
  const toast = useToast();
  const [updating, setUpdating] = useState(true);
  const [retrying, setRetrying] = useState(false);
  return (
    <Section id="feedback" title="Feedback states" refs="UpdatingMark (§3.2) · Tooltip · Skeleton · EmptyState · ErrorState · Toast">
      <div className="sg__grid">
        <Spec label="UpdatingMark (fades in after a short delay)">
          <div className="sg__row">
            <span className="k-text-md k-medium">Mon, Feb 9, 2026</span>
            <UpdatingMark active={updating} />
            <Button size="sm" variant="quiet" onClick={() => setUpdating(u => !u)}>{updating ? 'Stop' : 'Start'}</Button>
          </div>
        </Spec>
        <Spec label="Tooltip (open) and TruncatedText">
          <div className="sg__stack">
            <Tooltip content="Ready at 60, from /meta" forceOpen side="bottom"><span className="k-text-sm k-secondary" tabIndex={0}>Score threshold</span></Tooltip>
            <div className="sg__narrow"><TruncatedText>The Saint Bartholomew-Okonkwo Preparatory School for the Sciences and Humanities</TruncatedText></div>
          </div>
        </Spec>
        <Spec label="Skeleton shapes">
          <div className="sg__stack">
            <Skeleton width="40%" height="display" />
            <Skeleton width="90%" />
            <Skeleton width="60%" height="label" />
            <Skeleton width="var(--size-search)" height="control" />
          </div>
        </Spec>
        <Spec label="EmptyState">
          <EmptyState action={{ label: 'Save a snapshot for Feb 2', onClick: () => undefined }}>No snapshots yet. Save one to compare next Monday.</EmptyState>
        </Spec>
        <Spec label="ErrorState (retry in flight)">
          <ErrorState title="Couldn't load the backtest results." detail="GET /backtest/results → network error" retrying={retrying}
            onRetry={() => { setRetrying(true); window.setTimeout(() => setRetrying(false), 1200); }} />
        </Spec>
        <Spec label="Toast">
          <div className="sg__row">
            <Button size="sm" variant="secondary" onClick={() => toast({ message: 'Copied a.white@quillon.example' })}>Neutral</Button>
            <Button size="sm" variant="secondary" onClick={() => toast({ message: 'Sent to #sales (sample)', tone: 'success', action: { label: 'Open', onClick: () => undefined } })}>Success</Button>
            <Button size="sm" variant="secondary" onClick={() => toast({ message: "Couldn't send to Slack. The webhook isn't set.", tone: 'error' })}>Error</Button>
          </div>
        </Spec>
      </div>
    </Section>
  );
}

/* ── Page transitions ───────────────────────────────────────────────── */
function PagesSection() {
  const go = usePageTransition();
  const [page, setPage] = useState<'a' | 'b'>('a');
  return (
    <Section id="pages" title="PageTransition" refs="6A cross-fade over 1.5 × --motion-fast, nav excluded (View Transitions API, plain fade fallback)">
      <div className="sg__row">
        <SegmentedControl aria-label="Sample page" value={page} onChange={p => go(() => setPage(p))}
          options={[{ id: 'a', label: 'Ready to buy' }, { id: 'b', label: 'At risk' }]} />
      </div>
      <div className="sg__pages">
        <PageView key={page}>
          <p className="k-text-lg k-medium">{page === 'a' ? '9 schools ready to buy this week' : '4 paying schools slipping, $23,600 ARR'}</p>
          <p className="k-text-sm k-tertiary">Only this region cross-fades; the controls above stay still.</p>
        </PageView>
      </div>
    </Section>
  );
}
