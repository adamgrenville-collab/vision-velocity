import { useState } from 'react';
import Icon from './Icon.jsx';

export default function ApiKeySetup({ onSave }) {
  const [value, setValue] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const clean = value.trim();
    if (clean) onSave(clean);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <Icon name="key-2-line" className="mb-4 text-4xl text-blue-600" />
        <h2 className="mb-2 text-2xl font-bold text-slate-800">Set up the AI coach</h2>
        <p className="mb-6 text-sm text-slate-500">
          Paste your Google Gemini API key to turn on the coaching features. It stays on this device.
        </p>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="AIzaSy..."
          autoComplete="off"
          className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
        >
          Save &amp; launch
        </button>
      </form>
    </div>
  );
}
