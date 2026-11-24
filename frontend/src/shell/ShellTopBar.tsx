// The top bar: the page title at display size and, on screens scored for a week, the date control:
// the base WeekPager ("‹ Mon, Feb 2, 2026 ›", Demo date reset), the quiet Updating mark while a new
// week loads (§3.2), and the 10B WeekRuler under it (§3.5). Scrubbing state lives here, so a drag
// re-renders only the top bar; the app gets one as_of change per settled week.
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TopBar, UpdatingMark, WeekPager, WeekRuler, isoDay, mondaysBetween, parseDay, toMonday, type RulerBreak } from '../design';
import { fetchCalendar } from '../api';
import { useAsOf, useIsUpdating } from '../asOf';
import { type Screen, DATED_SCREENS, PAGE_TITLES, fmtDay } from '../nav';
import type { Meta, SchoolCalendar } from '../types';

/** Moves a weekend day to the nearest school day inside the range (Sat/Sun start → Monday; end → Friday). */
function weekdayEdge(day: string, dir: 1 | -1): string {
  const d = parseDay(day);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + dir);
  return isoDay(d);
}

function shiftDay(day: string, n: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return isoDay(d);
}

/**
 * Ruler shading from the shared calendar: its breaks, plus summer before the first day and after the
 * last day of school. Weekend edges are trimmed, so a break that starts on a Saturday doesn't shade
 * the school week before it.
 */
function rulerBreaks(cal: SchoolCalendar | undefined, meta: Meta): RulerBreak[] {
  if (!cal) return [];
  const out: RulerBreak[] = [];
  const add = (start: string, end: string, kind: RulerBreak['kind']) => {
    const s = weekdayEdge(start, 1);
    const e = weekdayEdge(end, -1);
    if (s <= e) out.push({ start: s, end: e, kind });
  };
  if (meta.sim_start < cal.first_day) add(meta.sim_start, shiftDay(cal.first_day, -1), 'summer');
  cal.breaks.forEach(b => add(b.start, b.end, 'break'));
  if (cal.last_day < meta.sim_end) add(shiftDay(cal.last_day, 1), meta.sim_end, 'summer');
  return out;
}

function useDateControl() {
  const { asOf, setAsOf, meta } = useAsOf();
  const updating = useIsUpdating();
  // The week under the pointer while scrubbing, tagged with the as_of it started from, so a settled
  // week (or a pager step) ends the preview without an effect.
  const [scrub, setScrub] = useState<{ from: string; week: string } | null>(null);
  const mondays = useMemo(() => mondaysBetween(meta.sim_start, meta.sim_end), [meta.sim_start, meta.sim_end]);
  const calendar = useQuery({
    queryKey: ['calendar', meta.shared_calendar],
    queryFn: () => fetchCalendar(meta.shared_calendar),
    staleTime: Infinity,
  });
  const breaks = useMemo(() => rulerBreaks(calendar.data, meta), [calendar.data, meta]);

  // While scrubbing, the pager label previews the week under the pointer; the data waits for release.
  const shown = scrub && scrub.from === asOf && scrub.week !== toMonday(asOf) ? scrub.week : asOf;

  // The base pager's label carries data-testid="as-of-label"; the app's test hook is "as-of".
  const pagerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const label = pagerRef.current?.querySelector('.k-weekpager__label');
    label?.setAttribute('data-testid', 'as-of');
    label?.setAttribute('data-value', asOf);
  });

  return {
    pager: (
      <div className="kshell-date" ref={pagerRef}>
        <UpdatingMark active={updating} />
        <WeekPager value={shown} min={meta.sim_start} max={meta.sim_end} demoDate={meta.demo_as_of} onChange={setAsOf} />
      </div>
    ),
    ruler: (
      <WeekRuler
        mondays={mondays}
        value={asOf}
        onChange={setAsOf}
        onScrub={week => setScrub({ from: asOf, week })}
        breaks={breaks}
        current={meta.demo_as_of}
        aria-label="Week of the school year"
      />
    ),
  };
}

/** Rendered as a component (not a hook in App) so scrub previews re-render only the top bar. */
function DatedTopBar({ screen }: { screen: Screen }) {
  const { pager, ruler } = useDateControl();
  return <TopBar title={PAGE_TITLES[screen]} actions={pager} below={ruler} />;
}

// Memoized (perf, Phase 3): App re-renders on every drawer open and page; the 52-tick ruler doesn't
// need to. It still follows as_of through the context.
export const ShellTopBar = memo(function ShellTopBar({ screen }: { screen: Screen }) {
  const { meta } = useAsOf();
  return (
    <div className="kshell-topbar" data-testid="top-bar">
      {DATED_SCREENS.includes(screen)
        ? <DatedTopBar screen={screen} />
        : (
          <TopBar
            title={PAGE_TITLES[screen]}
            subtitle={screen === 'backtest'
              ? `Replayed every Monday, ${fmtDay(meta.replay_start)} to ${fmtDay(meta.replay_end)}. The scorer never sees outcomes.`
              : undefined}
          />
        )}
    </div>
  );
});
