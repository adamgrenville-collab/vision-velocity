import { useState, useEffect, useMemo, useCallback } from 'react';
import { todayKey, shiftKey } from './lib/dates.js';
import { blankEntry, migrateAll, summarize, recentKeys } from './lib/entries.js';
import { readJson, writeJson, readRaw, writeRaw, remove, KEYS } from './lib/storage.js';
import { askCoach, coachPayloads } from './lib/coach.js';

import Icon from './components/Icon.jsx';
import Settings from './components/Settings.jsx';
import DateNav from './components/DateNav.jsx';
import MindsetCheckIn from './components/MindsetCheckIn.jsx';
import ActionPlan from './components/ActionPlan.jsx';
import ActivityTally from './components/ActivityTally.jsx';
import Rollup from './components/Rollup.jsx';

export default function App() {
  const [apiKey, setApiKey] = useState(() => readRaw(KEYS.apiKey) || '');
  const [market, setMarket] = useState(() => readRaw(KEYS.market) || '');
  const [entries, setEntries] = useState(() => migrateAll(readJson(KEYS.entries, {})));
  const [dateKey, setDateKey] = useState(todayKey);
  const [tab, setTab] = useState('daily');
  const [showSettings, setShowSettings] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState({ type: '', content: '' });
  const [justSaved, setJustSaved] = useState(false);

  // `entries` is the single source of truth; the visible day is derived from it.
  // Keeping one copy is what removes the old bug where saving clobbered the
  // form and wiped the coach's reply off screen.
  const entry = useMemo(() => entries[dateKey] ?? blankEntry(), [entries, dateKey]);

  // Persist on a short debounce so a dropped phone never costs a day's tally.
  useEffect(() => {
    const timer = setTimeout(() => writeJson(KEYS.entries, entries), 400);
    return () => clearTimeout(timer);
  }, [entries]);

  // A backgrounded tab may never run the debounce, so flush on the way out.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') writeJson(KEYS.entries, entries);
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, [entries]);

  const updateEntry = useCallback(
    (mutate) => {
      setEntries((prev) => ({ ...prev, [dateKey]: mutate(prev[dateKey] ?? blankEntry()) }));
    },
    [dateKey]
  );

  const goToDate = (nextKey) => {
    setDateKey(nextKey);
    setAiResponse({ type: '', content: '' });
  };

  const setMindset = (field, value) =>
    updateEntry((e) => ({ ...e, mindset: { ...e.mindset, [field]: value } }));

  const adjustActivity = (key, delta) =>
    updateEntry((e) => ({
      ...e,
      activities: { ...e.activities, [key]: Math.max(0, (e.activities[key] || 0) + delta) }
    }));

  const toggleTarget = (index) =>
    updateEntry((e) => {
      const actionPlan = e.actionPlan.slice();
      actionPlan[index] = { ...actionPlan[index], done: !actionPlan[index].done };
      return { ...e, actionPlan };
    });

  const setTargetText = (index, text) =>
    updateEntry((e) => {
      const actionPlan = e.actionPlan.slice();
      actionPlan[index] = { ...actionPlan[index], text };
      return { ...e, actionPlan };
    });

  const saveNow = () => {
    writeJson(KEYS.entries, entries);
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

  const saveSettings = ({ market: nextMarket, apiKey: nextKey }) => {
    setMarket(nextMarket);
    writeRaw(KEYS.market, nextMarket);

    setApiKey(nextKey);
    if (nextKey) writeRaw(KEYS.apiKey, nextKey);
    else remove(KEYS.apiKey);
  };

  const weekKeys = recentKeys(entries, 7);
  const summary = summarize(entries, weekKeys);

  return (
    <div className="app-container text-slate-900">
      <header className="bg-linear-to-r from-indigo-600 to-blue-800 p-6 pt-12 text-white shadow-lg">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vision &amp; Velocity</h1>
            <p className="text-sm text-blue-100 italic">You, amplified</p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
            className="rounded-xl bg-white/20 p-3 transition-colors hover:bg-white/30"
          >
            <Icon name="settings-4-line" className="text-xl" />
          </button>
        </div>
      </header>

      <nav className="sticky top-0 z-10 flex justify-center gap-4 border-b border-slate-200 bg-white p-4 shadow-xs">
        {[
          { id: 'daily', label: 'Daily log', icon: 'calendar-line' },
          { id: 'summary', label: 'Roll-up', icon: 'bar-chart-box-line' }
        ].map((item) => (
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

      <main className="mx-auto max-w-2xl space-y-6 p-4">
        {tab === 'daily' ? (
          <div className="space-y-6">
            <DateNav
              dateKey={dateKey}
              onShift={(days) => goToDate(shiftKey(dateKey, days))}
              onToday={() => goToDate(todayKey())}
            />

            <MindsetCheckIn
              mindset={entry.mindset}
              onChange={setMindset}
              onReframe={() => runCoach('mindset', 'reframe', coachPayloads.reframe(entry, market))}
              onDraftPost={() => runCoach('social', 'social', coachPayloads.social(entry, market))}
              isAiLoading={isAiLoading}
              aiResponse={aiResponse}
            />

            <ActionPlan plan={entry.actionPlan} onToggle={toggleTarget} onChangeText={setTargetText} />

            <ActivityTally activities={entry.activities} onAdjust={adjustActivity} />

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
                Changes save automatically as you type
              </p>
            </div>
          </div>
        ) : (
          <Rollup
            summary={summary}
            dayCount={weekKeys.length}
            onAnalyze={() => runCoach('coaching', 'gap', coachPayloads.gap(entries, weekKeys, market))}
            isAiLoading={isAiLoading}
            aiResponse={aiResponse}
          />
        )}
      </main>

      {showSettings && (
        <Settings
          market={market}
          apiKey={apiKey}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
