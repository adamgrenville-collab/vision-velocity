import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { todayKey, shiftKey, formatKey } from './lib/dates.js';
import { blankEntry, migrateAll, summarize } from './lib/entries.js';
import {
  blankSession,
  migrateSessions,
  migrateSession,
  nextSession,
  windowForSession,
  DEFAULT_CYCLE_DAYS
} from './lib/sessions.js';
import { dailyProgress, weeklyProgress, dailyStreak, adherence, hasAnyStandard } from './lib/standards.js';
import { readJson, writeJson, readRaw, writeRaw, remove, readProfile, KEYS } from './lib/storage.js';
import { askCoach, coachPayloads } from './lib/coach.js';
import { whoAmI, signOut, startSignIn, syncNow, toDocument } from './lib/sync.js';
import { differs } from './lib/merge.js';

import Icon from './components/Icon.jsx';
import Settings from './components/Settings.jsx';
import AccountBar from './components/AccountBar.jsx';
import DateNav from './components/DateNav.jsx';
import MindsetCheckIn from './components/MindsetCheckIn.jsx';
import ActionPlan from './components/ActionPlan.jsx';
import CounterList, { ACTIVITY_ITEMS, PRODUCTION_ITEMS } from './components/CounterList.jsx';
import Rollup from './components/Rollup.jsx';
import SessionPrep from './components/SessionPrep.jsx';
import Standards from './components/Standards.jsx';

/** Immutably set a dotted path, e.g. "pipeline.nextSteps" or "commitments.1.text". */
function setIn(target, path, value) {
  const [head, ...rest] = path.split('.');
  const clone = Array.isArray(target) ? target.slice() : { ...target };
  clone[head] = rest.length ? setIn(target[head], rest.join('.'), value) : value;
  return clone;
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => readRaw(KEYS.apiKey) || '');
  const [profile, setProfile] = useState(readProfile);
  const [entries, setEntries] = useState(() => migrateAll(readJson(KEYS.entries, {})));
  const [sessions, setSessions] = useState(() => migrateSessions(readJson(KEYS.sessions, [])));

  const [account, setAccount] = useState({ signedIn: false, configured: false });
  const [syncStatus, setSyncStatus] = useState('idle');

  const [dateKey, setDateKey] = useState(todayKey);
  const [tab, setTab] = useState('daily');
  const [showSettings, setShowSettings] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState({ type: '', content: '' });
  const [justSaved, setJustSaved] = useState(false);

  const entry = useMemo(() => entries[dateKey] ?? blankEntry(), [entries, dateKey]);
  const tomorrowKey = useMemo(() => shiftKey(dateKey, 1), [dateKey]);
  const tomorrow = useMemo(() => entries[tomorrowKey] ?? blankEntry(), [entries, tomorrowKey]);

  const activeSession = useMemo(() => {
    const upcoming = nextSession(sessions, todayKey());
    if (upcoming) return upcoming;
    return migrateSession(blankSession(shiftKey(todayKey(), DEFAULT_CYCLE_DAYS)));
  }, [sessions]);

  // ---- local persistence: always, regardless of account ---------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      writeJson(KEYS.entries, entries);
      writeJson(KEYS.sessions, sessions);
      writeJson(KEYS.profile, profile);
    }, 400);
    return () => clearTimeout(timer);
  }, [entries, sessions, profile]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') {
        writeJson(KEYS.entries, entries);
        writeJson(KEYS.sessions, sessions);
        writeJson(KEYS.profile, profile);
      }
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, [entries, sessions, profile]);

  // ---- sync -----------------------------------------------------------------
  const applyMerged = useCallback((merged) => {
    setEntries((prev) => (differs(prev, merged.entries) ? merged.entries : prev));
    setSessions((prev) => (differs(prev, merged.sessions) ? merged.sessions : prev));
    setProfile((prev) => (differs(prev, merged.profile) ? merged.profile : prev));
  }, []);

  const latest = useRef({ entries, sessions, profile });
  latest.current = { entries, sessions, profile };

  const runSync = useCallback(async () => {
    setSyncStatus('syncing');
    const { entries: e, sessions: s, profile: p } = latest.current;
    const result = await syncNow(toDocument(e, s, p));
    applyMerged(result.data);
    setSyncStatus(result.status);
    if (result.status === 'signed-out') setAccount((a) => ({ ...a, signedIn: false }));
  }, [applyMerged]);

  // On load: find out whether sign-in exists and whether we are signed in.
  useEffect(() => {
    let cancelled = false;
    whoAmI().then((who) => {
      if (cancelled) return;
      setAccount(who);
      if (who.signedIn) runSync();
    });
    return () => {
      cancelled = true;
    };
  }, [runSync]);

  // Push local changes up, debounced. Local storage has already saved them, so
  // this failing costs nothing.
  useEffect(() => {
    if (!account.signedIn) return undefined;
    const timer = setTimeout(runSync, 2500);
    return () => clearTimeout(timer);
  }, [entries, sessions, profile, account.signedIn, runSync]);

  // Coming back to the tab is the moment another device's edits matter most.
  useEffect(() => {
    if (!account.signedIn) return undefined;
    const onVisible = () => {
      if (document.visibilityState === 'visible') runSync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [account.signedIn, runSync]);

  // ---- editing --------------------------------------------------------------
  const updateEntryFor = useCallback((key, mutate) => {
    setEntries((prev) => ({
      ...prev,
      [key]: { ...mutate(prev[key] ?? blankEntry()), updatedAt: Date.now() }
    }));
  }, []);

  const updateEntry = useCallback(
    (mutate) => updateEntryFor(dateKey, mutate),
    [dateKey, updateEntryFor]
  );

  const withSession = useCallback(
    (transform) => {
      setSessions((prev) => {
        const exists = prev.some((s) => s.id === activeSession.id);
        const base = exists ? prev : [...prev, activeSession];
        return base.map((s) =>
          s.id === activeSession.id ? { ...transform(s), updatedAt: Date.now() } : s
        );
      });
    },
    [activeSession]
  );

  const updateSession = useCallback(
    (path, value) => withSession((s) => setIn(s, path, value)),
    [withSession]
  );

  const setSessionDate = useCallback(
    (date) => date && withSession((s) => ({ ...s, date })),
    [withSession]
  );

  const goToDate = (nextKey) => {
    setDateKey(nextKey);
    setAiResponse({ type: '', content: '' });
  };

  const setMindset = (field, value) =>
    updateEntry((e) => ({ ...e, mindset: { ...e.mindset, [field]: value } }));

  const adjust = (group) => (key, delta) =>
    updateEntry((e) => ({
      ...e,
      [group]: { ...e[group], [key]: Math.max(0, (e[group][key] || 0) + delta) }
    }));

  const planEditor = (targetKey) => ({
    onToggle: (index) =>
      updateEntryFor(targetKey, (e) => {
        const actionPlan = e.actionPlan.slice();
        actionPlan[index] = { ...actionPlan[index], done: !actionPlan[index].done };
        return { ...e, actionPlan };
      }),
    onChangeText: (index, text) =>
      updateEntryFor(targetKey, (e) => {
        const actionPlan = e.actionPlan.slice();
        actionPlan[index] = { ...actionPlan[index], text };
        return { ...e, actionPlan };
      })
  });

  const saveNow = () => {
    writeJson(KEYS.entries, entries);
    writeJson(KEYS.sessions, sessions);
    writeJson(KEYS.profile, profile);
    if (account.signedIn) runSync();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1600);
  };

  const runCoach = async (type, kind, payload) => {
    setIsAiLoading(true);
    try {
      const result = await askCoach(kind, payload, apiKey);
      setAiResponse({ type, content: result.ok ? result.text : result.message });
    } finally {
      setIsAiLoading(false);
    }
  };

  const saveSettings = (next) => {
    setProfile({
      name: next.name,
      market: next.market,
      goals: next.goals,
      standards: next.standards,
      updatedAt: Date.now()
    });
    setApiKey(next.apiKey);
    if (next.apiKey) writeRaw(KEYS.apiKey, next.apiKey);
    else remove(KEYS.apiKey);
  };

  const handleSignOut = async () => {
    await signOut();
    setAccount((a) => ({ ...a, signedIn: false, email: '', name: '' }));
    setSyncStatus('idle');
  };

  const cycleKeys = useMemo(
    () => windowForSession(sessions, activeSession),
    [sessions, activeSession]
  );
  const summary = useMemo(() => summarize(entries, cycleKeys), [entries, cycleKeys]);

  // Standards are measured against whichever day is on screen, so paging back
  // to Tuesday answers "did I hold the standard on Tuesday" rather than always
  // re-reporting today.
  const standards = profile.standards;
  const standardsView = useMemo(
    () =>
      hasAnyStandard(standards)
        ? {
            daily: dailyProgress(entry, standards),
            weekly: weeklyProgress(entries, dateKey, standards),
            streak: dailyStreak(entries, dateKey, standards),
            adherence: adherence(entries, dateKey, standards)
          }
        : null,
    [entries, entry, dateKey, standards]
  );

  const daysToSession = useMemo(() => {
    const diff = Math.round((new Date(activeSession.date) - new Date(todayKey())) / 86400000);
    return Number.isFinite(diff) ? diff : null;
  }, [activeSession.date]);

  const TABS = [
    { id: 'daily', label: 'Tonight', icon: 'calendar-line' },
    { id: 'rollup', label: 'Progress', icon: 'bar-chart-box-line' },
    { id: 'session', label: 'Session', icon: 'group-line' }
  ];

  return (
    <div className="app-container text-slate-900">
      <header className="bg-linear-to-r from-indigo-600 to-blue-800 p-6 pt-12 text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">Vision &amp; Velocity</h1>
            <p className="text-sm text-blue-100 italic">You, amplified</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {daysToSession !== null && daysToSession >= 0 && (
              <div className="hidden rounded-xl bg-white/15 px-3 py-2 text-center lg:block">
                <p className="text-[10px] font-bold uppercase opacity-80">Next session</p>
                <p className="text-sm font-bold">
                  {daysToSession === 0 ? 'Today' : `${daysToSession} days`}
                </p>
              </div>
            )}
            <AccountBar
              account={account}
              syncStatus={syncStatus}
              onSignIn={startSignIn}
              onSignOut={handleSignOut}
            />
            <button
              onClick={() => setShowSettings(true)}
              aria-label="Settings"
              className="rounded-xl bg-white/20 p-3 transition-colors hover:bg-white/30"
            >
              <Icon name="settings-4-line" className="text-xl" />
            </button>
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-10 flex justify-center gap-2 border-b border-slate-200 bg-white p-3 shadow-xs sm:gap-4 sm:p-4">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              tab === item.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon name={item.icon} /> {item.label}
          </button>
        ))}
      </nav>

      <main className={`mx-auto space-y-5 p-4 ${tab === 'session' ? 'max-w-5xl' : 'max-w-2xl'}`}>
        {tab === 'daily' && (
          <div className="space-y-5">
            <DateNav
              dateKey={dateKey}
              onShift={(days) => goToDate(shiftKey(dateKey, days))}
              onToday={() => goToDate(todayKey())}
            />

            <ActionPlan
              title="Today's focus"
              subtitle="What you committed to last night"
              icon="sun-line"
              accent="text-amber-600"
              plan={entry.actionPlan}
              emptyHint="Nothing was set for today. Plan tomorrow at the bottom of this screen."
              {...planEditor(dateKey)}
            />

            <MindsetCheckIn
              mindset={entry.mindset}
              onChange={setMindset}
              onReframe={() =>
                runCoach('mindset', 'reframe', coachPayloads.reframe(entry, profile.market))
              }
              isAiLoading={isAiLoading}
              aiResponse={aiResponse}
            />

            {standardsView && (
              <Standards
                {...standardsView}
                isToday={dateKey === todayKey()}
                onEdit={() => setShowSettings(true)}
              />
            )}

            <CounterList
              title="Activity"
              icon="flashlight-line"
              accent="text-red-600"
              items={ACTIVITY_ITEMS}
              values={entry.activities}
              onAdjust={adjust('activities')}
            />

            <CounterList
              title="Production"
              icon="award-line"
              accent="text-emerald-700"
              items={PRODUCTION_ITEMS}
              values={entry.production}
              onAdjust={adjust('production')}
            />

            <ActionPlan
              title="Plan tomorrow"
              subtitle={`Three actions for ${formatKey(tomorrowKey)}`}
              icon="moon-line"
              accent="text-indigo-600"
              plan={tomorrow.actionPlan}
              {...planEditor(tomorrowKey)}
            />

            <div className="fixed bottom-6 left-1/2 w-full max-w-md -translate-x-1/2 px-4">
              <button
                onClick={saveNow}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-bold text-white shadow-xl transition-colors active:scale-95 ${
                  justSaved ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <Icon name={justSaved ? 'check-line' : 'save-line'} className="text-xl" />
                {justSaved ? 'Saved' : 'Save progress'}
              </button>
              <p className="mt-2 text-center text-[10px] text-slate-400">
                {account.signedIn
                  ? 'Saves as you type and syncs to your other devices'
                  : 'Changes save automatically as you type'}
              </p>
            </div>
          </div>
        )}

        {tab === 'rollup' && (
          <Rollup
            summary={summary}
            windowDays={cycleKeys.length}
            onAnalyze={() =>
              runCoach('coaching', 'gap', coachPayloads.gap(entries, cycleKeys, profile.market))
            }
            isAiLoading={isAiLoading}
            aiResponse={aiResponse}
          />
        )}

        {tab === 'session' && (
          <SessionPrep
            session={activeSession}
            sessions={
              sessions.some((s) => s.id === activeSession.id) ? sessions : [...sessions, activeSession]
            }
            entries={entries}
            goals={profile.goals}
            name={profile.name}
            onChange={updateSession}
            onSetDate={setSessionDate}
            onMarkSubmitted={() => updateSession('submitted', true)}
          />
        )}
      </main>

      {showSettings && (
        <Settings
          name={profile.name}
          market={profile.market}
          apiKey={apiKey}
          goals={profile.goals}
          standards={standards}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
