import Icon from './Icon.jsx';

export default function Rollup({ summary, dayCount, onAnalyze, isAiLoading, aiResponse }) {
  return (
    <div className="space-y-6 pb-8">
      <div className="px-2">
        <h2 className="text-xl font-bold text-slate-800">Weekly roll-up</h2>
        <p className="text-sm text-slate-500">
          {dayCount === 0
            ? 'No days logged yet.'
            : `Across your last ${dayCount} logged ${dayCount === 1 ? 'day' : 'days'}.`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-blue-600 p-5 text-white shadow-sm">
          <p className="text-xs font-bold uppercase opacity-80">Conversations</p>
          <p className="text-4xl font-black">{summary.conversations}</p>
        </div>
        <div className="rounded-2xl bg-amber-500 p-5 text-white shadow-sm">
          <p className="text-xs font-bold uppercase opacity-80">Check-ins</p>
          <p className="text-4xl font-black">{summary.totalActivities.clientCheckIns}</p>
        </div>
      </div>

      {summary.roadblocks.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-slate-100 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <Icon name="alert-line" className="text-xl text-amber-500" />
            <h3>Roadblocks you named</h3>
          </div>
          <ul className="space-y-1 text-sm text-slate-600">
            {summary.roadblocks.map((r) => (
              <li key={r.date}>
                <span className="font-mono text-xs text-slate-400">{r.date}</span> — {r.roadblock}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4 rounded-3xl bg-indigo-900 p-6 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <Icon name="sparkling-line" className="text-xl text-blue-300" />
            <h3>Coach: gap analysis</h3>
          </div>
          <button
            onClick={onAnalyze}
            disabled={isAiLoading}
            aria-label="Run gap analysis"
            className="rounded-xl bg-white/20 p-2 hover:bg-white/30 disabled:opacity-50"
          >
            <Icon
              name={isAiLoading ? 'loader-4-line' : 'send-plane-fill'}
              className={`text-xl ${isAiLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        {aiResponse.type === 'coaching' && aiResponse.content ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {aiResponse.content}
          </div>
        ) : (
          <p className="text-sm text-blue-100">Tap send to have the coach look for gaps in your week.</p>
        )}
      </section>
    </div>
  );
}
