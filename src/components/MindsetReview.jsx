import Icon from './Icon.jsx';

const shortDate = (key) => String(key).slice(5).replace('-', '/');

function Entries({ label, items, tone }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold text-slate-500 uppercase">
        {label} <span className="font-normal">({items.length})</span>
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.date} className="flex gap-2 text-sm">
            <span className="shrink-0 font-mono text-xs text-slate-400">{shortDate(item.date)}</span>
            <span className={tone}>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Everything written in the nightly check-ins across this cycle, plus the one
 * thing the numbers alone cannot show: whether the days that felt bad were the
 * days that actually produced less.
 */
export default function MindsetReview({ summary, narrative }) {
  if (!summary.checkedIn) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-bold text-blue-800">
          <Icon name="emotion-line" className="text-xl" />
          <h3>Mindset across this cycle</h3>
        </div>
        <p className="pt-3 text-sm text-slate-400 italic">
          No check-ins logged yet this cycle. The nightly questions on the Tonight tab fill this in.
        </p>
      </div>
    );
  }

  const effect = summary.effect;

  return (
    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-xs lg:col-span-2">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-bold text-blue-800">
        <Icon name="emotion-line" className="text-xl" />
        <h3>Mindset across this cycle</h3>
      </div>

      <p className="text-sm leading-relaxed text-slate-700">{narrative}</p>

      {effect && (
        <div
          className={`rounded-xl border p-3 ${
            effect.changePercent < 0
              ? 'border-amber-200 bg-amber-50'
              : 'border-emerald-200 bg-emerald-50'
          }`}
        >
          <p className="text-[10px] font-bold text-slate-500 uppercase">
            What roadblocks actually cost
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {effect.changePercent < 0 ? (
              <>
                On the <strong>{effect.blockedDays} days</strong> you named something in the way, you
                averaged <strong>{effect.blockedMean}</strong> touches — against{' '}
                <strong>{effect.clearMean}</strong> on the {effect.clearDays} clear days.{' '}
                <strong>{Math.abs(effect.changePercent)}% lower.</strong>
              </>
            ) : (
              <>
                Activity held up on the {effect.blockedDays} blocked days —{' '}
                <strong>{effect.blockedMean}</strong> touches against{' '}
                <strong>{effect.clearMean}</strong> on clear days. Whatever got in the way, you worked
                through it.
              </>
            )}
          </p>
        </div>
      )}

      {summary.roadblockThemes.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold text-slate-500 uppercase">
            Came up more than once
          </p>
          <div className="flex flex-wrap gap-2">
            {summary.roadblockThemes.map((theme) => (
              <span
                key={theme.word}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {theme.word} <span className="text-slate-400">×{theme.days}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Entries label="Wins" items={summary.wins} tone="text-emerald-800" />
        <Entries label="What slowed me down" items={summary.roadblocks} tone="text-amber-900" />
        <Entries label="How I felt" items={summary.feelings} tone="text-slate-600" />
      </div>
    </section>
  );
}
