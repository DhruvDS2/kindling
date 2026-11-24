// The drawer's usage section body: the 5A chart, its window legend, the sentence that reads
// the change on the chosen window (school days or calendar days), and the day-by-day
// close-up under a disclosure. The toggle itself sits in the section header (AccountDetail).
import type { SchoolDetail, UsageDay } from '../../types';
import { NumberFlow } from '../../design';
import { type Span, pctChange, plural, rangeLabel, windowStats } from './model';
import { COLORS } from './scale';
import UsageChart, { type WindowMode } from './UsageChart';
import WindowLens from './WindowLens';
import { Disclosure, Key } from './ui';

interface Props {
  width: number;
  days: UsageDay[];
  d0: number;
  asOf: string;
  asOfN: number;
  breaks: Span[];
  summers: Span[];
  windows: SchoolDetail['windows'];
  mode: WindowMode;
  reveal?: boolean;
}

export default function UsageBody({ width, days, d0, asOf, asOfN, breaks, summers, windows, mode, reveal }: Props) {
  const w = mode === 'school_days' ? windows.school_days : windows.calendar;
  const unit = mode === 'school_days' ? 'school days' : 'calendar days';
  const color = mode === 'school_days' ? COLORS.kindling : COLORS.naive;
  return (
    <div className="kd-usage">
      <UsageChart width={width} days={days} d0={d0} asOf={asOfN} breaks={breaks} summers={summers}
        windows={windows} mode={mode} reveal={reveal} />
      <div className="kd-legend" data-testid="usage-legend">
        <Key swatch={color}>Last {w.length} {unit}{w.start <= w.end ? ` · ${rangeLabel(w.start, w.end)}` : ''}</Key>
        {w.prev_start && w.prev_start <= w.prev_end && (
          <Key swatch={color} faded>Prior {w.length} · {rangeLabel(w.prev_start, w.prev_end)}</Key>
        )}
        {breaks.length > 0 && <Key swatch={COLORS.break}>Break</Key>}
        {summers.length > 0 && <Key swatch={COLORS.summer} faded>Summer</Key>}
      </div>
      <ChangeSentence days={days} windows={windows} mode={mode} />
      <Disclosure label="Day by day" hint="both windows, close up" testId="usage-day-by-day">
        <WindowLens width={width} days={days} windows={windows} asOf={asOf} d0={d0} breaks={breaks} summers={summers} metric="sessions" />
      </Disclosure>
    </div>
  );
}

/** "On school days, student sessions fell 68% (73 → 23) …": the change the chosen window reads. */
function ChangeSentence({ days, windows, mode }: { days: UsageDay[]; windows: SchoolDetail['windows']; mode: WindowMode }) {
  const w = mode === 'school_days' ? windows.school_days : windows.calendar;
  const cur = windowStats(days, w.start, w.end);
  const prev = windowStats(days, w.prev_start, w.prev_end);
  const sdCur = windowStats(days, windows.school_days.start, windows.school_days.end);
  const sdPrev = windowStats(days, windows.school_days.prev_start, windows.school_days.prev_end);
  const same = windows.school_days.start === windows.calendar.start && windows.school_days.prev_start === windows.calendar.prev_start;
  const lead = mode === 'school_days' ? 'On school days' : 'On calendar days';
  const span = mode === 'school_days'
    ? `the last ${w.length} school days against the ${w.length} before`
    : `the last ${w.length} days against the ${w.length} before`;

  let body;
  if (!cur || cur.days === 0) {
    body = <>{lead}, there is no full window yet at this date.</>;
  } else if (!prev || prev.days === 0) {
    body = <>{lead}, the last window holds <Num v={cur.sessions} /> student sessions. There is no prior window yet to compare.</>;
  } else {
    const pct = pctChange(cur.sessions, prev.sessions);
    const verb = pct === null ? (cur.sessions > 0 ? 'started' : 'had none') : pct < 0 ? 'fell' : pct > 0 ? 'rose' : 'held steady';
    const change = pct === null || pct === 0
      ? <strong className="kd-sentence__em">{verb}</strong>
      : <strong className="kd-sentence__em">{verb} <NumberFlow value={Math.abs(pct)} reveal={false} format={n => `${Math.round(n)}%`} /></strong>;
    let context: string;
    if (mode === 'school_days') {
      context = same ? 'No break in either window, so calendar days read the same.' : 'Weekends and breaks are skipped.';
    } else if (same) {
      context = 'No break in either window, so school days read the same.';
    } else if (sdCur && cur.schoolDays < sdCur.schoolDays) {
      context = `Only ${plural(cur.schoolDays, 'school day')} of the last ${w.length} days${cur.breakDays ? `; ${plural(cur.breakDays, 'day')} ${cur.breakDays === 1 ? 'was' : 'were'} a break` : ''}.`;
    } else if (sdPrev && prev.schoolDays < sdPrev.schoolDays) {
      context = `The ${w.length} days before held only ${plural(prev.schoolDays, 'school day')}${prev.breakDays ? `; ${plural(prev.breakDays, 'day')} of break` : ''}.`;
    } else {
      context = 'Breaks and weekends count as days.';
    }
    body = (
      <>
        {lead}, student sessions {change} (<Num v={prev.sessions} /> → <Num v={cur.sessions} />), {span}. {context}
      </>
    );
  }
  return <p className="kd-sentence" data-testid="usage-sentence" aria-live="polite">{body}</p>;
}

const Num = ({ v }: { v: number }) => <NumberFlow value={v} reveal={false} className="kd-sentence__num" />;
