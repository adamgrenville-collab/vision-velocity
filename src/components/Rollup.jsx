import Icon from './Icon.jsx';
import { ACTIVITY_ITEMS, PRODUCTION_ITEMS } from './CounterList.jsx';

function Stat({ label, value, sub, tone }) {
  return (
    <div className={`rounded-2xl p-4 text-white shadow-sm ${tone}`}>
      <p className="text-[10px] font-bold uppercase opacity-80">{label}</p>
      <p className="text-3xl font-black tabular-nums">{value}</p>
      {sub && <p className="text-[10px] opacity-80">{sub}</p>}
    </div>
  );
}

/**
 * The two-week view. The cycle length matches the coaching session cadence, so
 * these totals are the ones that go on the form — the point being that nobody
 * has to add anything up on the drive over.
 */
export default function Rollup({ summary, windowDays, onAnalyze, isAiLoading, aiResponse }) {
  const followThrough =
    summary.targetsSet > 0 ? Math.round((summary.targetsDone / summary.targetsSet) * 100) : null;

  return (
    <div className="space-y-6 pb-8">
      <div className="px-1">
        <h2 className="text-xl font-bold text-slate-800">Since last session</h2>
        <p className="text-sm text-slate-500">
          Last {windowDays} days · logged {summary.daysLogged} of them
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Conversations"
          value={summary.conversations}
          sub="calls + texts"
          tone="bg-blue-600"
        />
        <Stat
          label="Total activity"
          value={summary.totalActivity}
          sub="every touch logged"
          tone="bg-indigo-600"
        />
        <Stat
          label="Follow-through"
          value={followThrough === null ? '—' : `${followThrough}%`}
          sub={`${summary.targetsDone} of ${summary.targetsSet} actions`}
          tone="bg-emerald-600"
        />
        <Stat
          label="Consistency"
          value={`${summary.daysLogged}/${windowDays}`}
          sub="nights logged"
          tone={summary.daysLogged >= windowDays * 0.7 ? 'bg-emerald-600' : 'bg-amber-500'}
        />
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
        <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3 font-bold text-red-600">
          <Icon name="flashlight-line" className="text-xl" />
          <h3>Activity snapshot</h3>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
          {ACTIVITY_ITEMS.map((item) => (
            <div key={item.key} className="flex items-center justify-between py-1 text-sm">
              <dt className="flex items-center gap-2 text-slate-600">
                <Icon name={item.icon} className="text-slate-300" />
                {item.label}
              </dt>
              <dd className="font-bold tabular-nums text-slate-800">
                {summary.totalActivities[item.key]}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
        <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3 font-bold text-emerald-700">
          <Icon name="award-line" className="text-xl" />
          <h3>Production</h3>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {PRODUCTION_ITEMS.map((item) => (
            <div key={item.key} className="rounded-xl bg-slate-50 py-3">
              <dt className="text-[10px] font-bold text-slate-500 uppercase">{item.label}</dt>
              <dd className="text-2xl font-black tabular-nums text-slate-800">
                {summary.totalProduction[item.key]}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {summary.roadblocks.length > 0 && (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3 font-bold text-slate-700">
            <Icon name="alert-line" className="text-xl text-amber-500" />
            <h3>What slowed me down</h3>
          </div>
          <ul className="space-y-2 text-sm text-slate-600">
            {summary.roadblocks.map((r) => (
              <li key={r.date} className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-slate-400">{r.date.slice(5)}</span>
                <span>{r.roadblock}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4 rounded-3xl bg-indigo-900 p-5 text-white shadow-xl">
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
          <p className="text-sm text-blue-100">
            Tap send to have the coach look for gaps before your next session.
          </p>
        )}
      </section>
    </div>
  );
}
