import { useState } from 'react';
import Icon from './Icon.jsx';

export default function Settings({ market, apiKey, onSave, onClose }) {
  const [marketDraft, setMarketDraft] = useState(market);
  const [keyDraft, setKeyDraft] = useState(apiKey);

  const submit = (e) => {
    e.preventDefault();
    onSave({ market: marketDraft.trim(), apiKey: keyDraft.trim() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={submit}
        className="max-h-full w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close settings" className="p-1 text-slate-400">
            <Icon name="close-line" className="text-2xl" />
          </button>
        </div>

        <div className="mb-6">
          <label htmlFor="market" className="text-[10px] font-bold text-slate-500 uppercase">
            Your market
          </label>
          <input
            id="market"
            type="text"
            value={marketDraft}
            onChange={(e) => setMarketDraft(e.target.value)}
            placeholder="e.g. Wesley Chapel, FL"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
          <p className="mt-1 text-xs text-slate-500">
            The coach mentions your area when it gives advice. Leave blank to keep it general.
          </p>
        </div>

        <div className="mb-6">
          <label htmlFor="apiKey" className="text-[10px] font-bold text-slate-500 uppercase">
            Your own Gemini API key <span className="font-normal normal-case">(optional)</span>
          </label>
          <input
            id="apiKey"
            type="password"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="AIzaSy..."
            autoComplete="off"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
          <p className="mt-1 text-xs text-slate-500">
            Coaching is free but capped each day. Add your own key from{' '}
            <span className="font-medium">Google AI Studio</span> for unlimited use. It is stored only
            on this device and sent only to Google.
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
