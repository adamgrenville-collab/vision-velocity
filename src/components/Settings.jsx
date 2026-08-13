import { useState } from 'react';
import Icon from './Icon.jsx';
import { ACTIVITY_ITEMS } from './CounterList.jsx';
import { migrateStandards, DEFAULT_STANDARDS } from '../lib/standards.js';
import { testKey } from '../lib/coach.js';
import ShareSettings from './ShareSettings.jsx';

import { blankGoal, migrateGoal, migrateGoals, METRICS, PERIODS } from '../lib/goals.js';

export default function Settings({
  name,
  market,
  apiKey,
  goals,
  standards,
  signedIn,
  onSave,
  onClose
}) {
  const [draft, setDraft] = useState({
    name,
    market,
    apiKey,
    goals: goals.length ? goals.map(migrateGoal) : [blankGoal()],
    standards: migrateStandards(standards)
  });

  const [keyTest, setKeyTest] = useState({ state: 'idle', message: '' });

  const setField = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  // Tests the key as typed, before saving — so a bad paste is caught here
  // rather than surfacing later as a coaching button that does nothing.
  const runKeyTest = async () => {
    setKeyTest({ state: 'testing', message: '' });
    const result = await testKey(draft.apiKey);
    setKeyTest({ state: result.ok ? 'ok' : 'failed', message: result.message });
  };

  const setGoal = (index, key, value) =>
    setDraft((d) => ({
      ...d,
      goals: d.goals.map((g, i) => (i === index ? { ...g, [key]: value } : g))
    }));

  const setStandard = (key, horizon, value) =>
    setDraft((d) => ({
      ...d,
      standards: { ...d.standards, [key]: { ...d.standards[key], [horizon]: value } }
    }));

  const submit = (e) => {
    e.preventDefault();
    onSave({
      name: draft.name.trim(),
      market: draft.market.trim(),
      apiKey: draft.apiKey.trim(),
      standards: migrateStandards(draft.standards),
      goals: migrateGoals(draft.goals)
    });
    onClose();
  };

  const input =
    'mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 focus:ring-2 focus:ring-blue-500 focus:outline-hidden';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <form
        onSubmit={submit}
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close settings" className="p-1 text-slate-400">
            <Icon name="close-line" className="text-2xl" />
          </button>
        </div>

        <div className="mb-5">
          <label htmlFor="name" className="text-[10px] font-bold text-slate-500 uppercase">
            Your name
          </label>
          <input
            id="name"
            type="text"
            value={draft.name}
            onChange={(e) => setField('name')(e.target.value)}
            placeholder="As it goes on your broker's form"
            className={input}
          />
        </div>

        <div className="mb-5">
          <label htmlFor="market" className="text-[10px] font-bold text-slate-500 uppercase">
            Your market
          </label>
          <input
            id="market"
            type="text"
            value={draft.market}
            onChange={(e) => setField('market')(e.target.value)}
            placeholder="e.g. Wesley Chapel, FL"
            className={input}
          />
          <p className="mt-1 text-xs text-slate-500">
            Used only to make coaching advice local. Leave blank to keep it general.
          </p>
        </div>

        <div className="mb-5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Goals</label>
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, goals: [...d.goals, blankGoal()] }))}
              className="flex items-center gap-1 text-xs font-bold text-blue-600"
            >
              <Icon name="add-line" /> Add
            </button>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            An outcome over a period. Pick something the app already logs and it counts itself.
          </p>

          <div className="space-y-3">
            {draft.goals.map((goal, index) => (
              <div key={goal.id || index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={goal.label}
                    onChange={(e) => setGoal(index, 'label', e.target.value)}
                    placeholder="e.g. Sides"
                    aria-label={`Name for goal ${index + 1}`}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({ ...d, goals: d.goals.filter((_, i) => i !== index) }))
                    }
                    aria-label={`Remove goal ${index + 1}`}
                    className="shrink-0 rounded-lg px-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  >
                    <Icon name="close-line" className="text-lg" />
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Count</span>
                    <select
                      value={goal.metric}
                      onChange={(e) => setGoal(index, 'metric', e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      {['Production', 'Activity', 'Other'].map((group) => (
                        <optgroup key={group} label={group}>
                          {METRICS.filter((m) => m.group === group).map((m) => (
                            <option key={m.key} value={m.key}>
                              {m.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Over</span>
                    <select
                      value={goal.period}
                      onChange={(e) => setGoal(index, 'period', e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      {PERIODS.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Target</span>
                    <input
                      type="number"
                      min="0"
                      value={goal.target}
                      onChange={(e) => setGoal(index, 'target', e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm tabular-nums focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </label>

                  {goal.metric === 'manual' && (
                    <label className="block">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        So far
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={goal.manualCurrent}
                        onChange={(e) => setGoal(index, 'manualCurrent', e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm tabular-nums focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </label>
                  )}
                </div>

                {goal.period === 'custom' && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {['start', 'end'].map((edge) => (
                      <label key={edge} className="block">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{edge}</span>
                        <input
                          type="date"
                          value={goal[edge]}
                          onChange={(e) => setGoal(index, edge, e.target.value)}
                          className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </label>
                    ))}
                  </div>
                )}

                {goal.metric !== 'manual' && (
                  <p className="mt-2 text-[10px] text-slate-400">
                    Counts itself from your daily log — nothing to update.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Standards</label>
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, standards: { ...DEFAULT_STANDARDS } }))}
              className="text-xs font-bold text-blue-600"
            >
              Reset to default
            </button>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            The minimum you hold yourself to. <strong>Daily</strong> is the morning block — keep it
            small enough to hit on a bad day. <strong>Weekly</strong> is quota work you can batch.
            Zero means it isn't a standard.
          </p>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
            <div className="flex gap-2 pr-1 pb-1 text-[10px] font-bold text-slate-400 uppercase">
              <span className="flex-1" />
              <span className="w-16 text-center">Daily</span>
              <span className="w-16 text-center">Weekly</span>
            </div>
            {ACTIVITY_ITEMS.map((item) => (
              <div key={item.key} className="flex items-center gap-2 py-1">
                <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-600">
                  <Icon name={item.icon} className="text-base text-slate-300" />
                  <span className="truncate">{item.label}</span>
                </span>
                {['daily', 'weekly'].map((horizon) => (
                  <input
                    key={horizon}
                    type="number"
                    min="0"
                    value={draft.standards[item.key][horizon]}
                    onChange={(e) => setStandard(item.key, horizon, e.target.value)}
                    aria-label={`${horizon} standard for ${item.label}`}
                    className="w-16 rounded-lg border border-slate-200 bg-white p-2 text-center text-sm tabular-nums focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <ShareSettings signedIn={signedIn} />

        <div className="mb-6">
          <label htmlFor="apiKey" className="text-[10px] font-bold text-slate-500 uppercase">
            Gemini API key <span className="font-normal normal-case">(optional)</span>
          </label>
          <input
            id="apiKey"
            type="password"
            value={draft.apiKey}
            onChange={(e) => setField('apiKey')(e.target.value)}
            placeholder="AIzaSy..."
            autoComplete="off"
            className={input}
          />
          <p className="mt-1 text-xs text-slate-500">
            Only needed for the AI coach — everything else works without it. Free from Google AI
            Studio, stored on this device, sent only to Google.
          </p>

          <button
            type="button"
            onClick={runKeyTest}
            disabled={!draft.apiKey.trim() || keyTest.state === 'testing'}
            className="mt-2 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
          >
            <Icon
              name={keyTest.state === 'testing' ? 'loader-4-line' : 'sparkling-line'}
              className={keyTest.state === 'testing' ? 'animate-spin' : ''}
            />
            {keyTest.state === 'testing' ? 'Testing…' : 'Test this key'}
          </button>

          {keyTest.message && (
            <p
              className={`mt-2 rounded-lg border p-2 text-xs ${
                keyTest.state === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              {keyTest.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white shadow-sm transition hover:bg-blue-700"
        >
          Save settings
        </button>
      </form>
    </div>
  );
}
