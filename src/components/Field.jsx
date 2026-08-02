/** Labelled textarea used throughout the session screen. */
export function TextField({ label, hint, value, onChange, rows = 3, placeholder }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
      />
    </div>
  );
}

/** Read-only block showing something the app worked out from the nightly logs. */
export function DerivedField({ label, value, note }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
        <span className="text-[10px] font-medium text-emerald-600">filled in for you</span>
      </div>
      {note && <p className="text-xs text-slate-400">{note}</p>}
      <pre className="mt-1 overflow-x-auto rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 font-sans text-sm whitespace-pre-wrap text-slate-700">
        {value || '—'}
      </pre>
    </div>
  );
}

/** Small labelled number input. */
export function NumberField({ label, value, onChange, hint }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-lg font-bold tabular-nums focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
      />
      {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}
