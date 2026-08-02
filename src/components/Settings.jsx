import { useState } from 'react';
import Icon from './Icon.jsx';

const blankGoal = () => ({ label: '', target: 0, current: 0, unit: '' });

export default function Settings({ name, market, apiKey, goals, onSave, onClose }) {
  const [draft, setDraft] = useState({
    name,
    market,
    apiKey,
    goals: goals.length ? goals : [blankGoal()]
  });

  const setField = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const setGoal = (index, key, value) =>
    setDraft((d) => ({
      ...d,
      goals: d.goals.map((g, i) => (i === index ? { ...g, [key]: value } : g))
    }));

  const submit = (e) => {
    e.preventDefault();
    onSave({
      name: draft.name.trim(),
      market: draft.market.trim(),
      apiKey: draft.apiKey.trim(),
      goals: draft.goals
        .filter((g) => g.label.trim())
        .map((g) => ({
          label: g.label.trim(),
          unit: String(g.unit || '').trim(),
          target: Math.max(0, Number(g.target) || 0),
          current: Math.max(0, Number(g.current) || 0)
        }))
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
            Anything you want to track — they don't have to be real estate.
          </p>

          <div className="space-y-2">
            {draft.goals.map((goal, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={goal.label}
                  onChange={(e) => setGoal(index, 'label', e.target.value)}
                  placeholder="Listings taken"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <input
                  type="number"
                  min="0"
                  value={goal.current}
                  onChange={(e) => setGoal(index, 'current', e.target.value)}
                  aria-label={`Current for goal ${index + 1}`}
                  className="w-16 rounded-xl border border-slate-200 bg-slate-50 p-2 text-center text-sm tabular-nums focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <span className="self-center text-xs text-slate-400">of</span>
                <input
                  type="number"
                  min="0"
                  value={goal.target}
                  onChange={(e) => setGoal(index, 'target', e.target.value)}
                  aria-label={`Target for goal ${index + 1}`}
                  className="w-16 rounded-xl border border-slate-200 bg-slate-50 p-2 text-center text-sm tabular-nums focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <input
                  type="text"
                  value={goal.unit}
                  onChange={(e) => setGoal(index, 'unit', e.target.value)}
                  placeholder="unit"
                  aria-label={`Unit for goal ${index + 1}`}
                  className="w-20 rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            ))}
          </div>
        </div>

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
