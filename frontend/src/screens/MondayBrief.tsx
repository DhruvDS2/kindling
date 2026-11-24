import { useEffect, useState } from 'react';
import { useAsOf } from '../asOf';
import { type Screen } from '../nav';
import { ReadyTop, Slipping } from './brief/BriefLists';
import { LastRun } from './brief/LastRun';
import { useStatsAt } from './brief/queries';
import { Narrative, WeekStats } from './brief/WeekStats';
import './ready/ready.css';
import './brief/brief.css';

interface Props {
  onNavigate: (screen: Screen, schoolId?: string) => void;
}

// Numbers count up once per visit to the app (DESIGN.md §3.3), not every time the rep comes back to the brief.
let revealedOnce = false;

/**
 * The Monday brief: the week in one sentence, four numbers with their change and trend, the top
 * schools ready to buy, the paying schools slipping before renewal, and the last alert run.
 * Every number and threshold comes from the API (/stats, /pql, /health, /meta, /automations/log).
 */
export default function MondayBrief({ onNavigate }: Props) {
  const { asOf, meta } = useAsOf();
  const { data: stats } = useStatsAt(asOf);
  const [reveal] = useState(() => !revealedOnce);
  useEffect(() => { revealedOnce = true; }, []);

  return (
    <div className="brief">
      <div className="brief-top">
        {/* The sentence counts through on a week change but doesn't count up on load: the four numbers below do that once. */}
        <Narrative stats={stats} />
        <WeekStats asOf={asOf} meta={meta} reveal={reveal} />
      </div>
      <ReadyTop
        asOf={asOf}
        meta={meta}
        definition={`Score ${meta.thresholds.pql_ready} or higher, highest first`}
        onOpen={id => onNavigate('ready', id)}
        onAll={() => onNavigate('ready')}
      />
      <Slipping
        asOf={asOf}
        meta={meta}
        definition={stats ? `${stats.definitions.at_risk}, lowest health first` : undefined}
        onOpen={id => onNavigate('risk', id)}
        onAll={() => onNavigate('risk')}
      />
      <LastRun onOpen={() => onNavigate('automations')} />
    </div>
  );
}
