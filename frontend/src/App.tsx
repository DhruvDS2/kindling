import { Suspense, useRef, useState } from 'react';
import { AppShell, PageView, usePageTransition } from './design';
import { type Screen, readUrl, writeUrl } from './nav';
import { ShellNav } from './shell/ShellNav';
import { ShellTopBar } from './shell/ShellTopBar';
import { ScreenBoundary, ScreenSkeleton } from './shell/ScreenFallback';
import { preloadScreen, resetScreen, screenView } from './shell/screens';

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => readUrl().screen ?? 'brief');
  const [focusSchoolId, setFocusSchoolId] = useState<string | null>(() => readUrl().school);
  const [retries, setRetries] = useState(0);
  const go = usePageTransition();
  const navSeq = useRef(0);

  function navigate(s: Screen, schoolId?: string) {
    const apply = () => {
      setScreen(s);
      setFocusSchoolId(schoolId ?? null);
      writeUrl({ screen: s, school: schoolId ?? null });
    };
    const seq = ++navSeq.current;
    if (s === screen) { apply(); return; }
    // 6A: load the next screen's chunk first, so the cross-fade lands on the screen, not its
    // fallback. Only the latest click wins if the rep clicks again while a chunk is loading.
    const switchPage = () => {
      if (seq !== navSeq.current) return;
      go(() => { apply(); window.scrollTo(0, 0); });
    };
    preloadScreen(s).then(switchPage, switchPage);
  }

  // The open detail drawer lives in the URL (?school=…) so a drawer can be linked or screenshotted.
  function selectSchool(schoolId: string | null) {
    setFocusSchoolId(schoolId);
    writeUrl({ school: schoolId });
  }

  const MondayBrief = screenView('brief');
  const ReadyToBuy = screenView('ready');
  const AtRisk = screenView('risk');
  const Pipeline = screenView('pipeline');
  const Prospects = screenView('prospects');
  const Backtest = screenView('backtest');
  const Automations = screenView('automations');

  return (
    <AppShell nav={<ShellNav active={screen} onSelect={s => navigate(s)} />} topBar={<ShellTopBar screen={screen} />}>
      {/* 6A: only this region cross-fades between screens; the nav and top bar stay still. */}
      <PageView key={screen}>
        <ScreenBoundary key={retries} screen={screen} onRetry={() => { resetScreen(screen); setRetries(n => n + 1); }}>
          <Suspense fallback={<ScreenSkeleton screen={screen} />}>
            {screen === 'brief' && <MondayBrief onNavigate={navigate} />}
            {screen === 'ready' && <ReadyToBuy schoolId={focusSchoolId} onSelectSchool={selectSchool} />}
            {screen === 'risk' && <AtRisk schoolId={focusSchoolId} onSelectSchool={selectSchool} />}
            {screen === 'pipeline' && <Pipeline />}
            {screen === 'prospects' && <Prospects />}
            {screen === 'backtest' && <Backtest />}
            {screen === 'automations' && <Automations />}
          </Suspense>
        </ScreenBoundary>
      </PageView>
    </AppShell>
  );
}
