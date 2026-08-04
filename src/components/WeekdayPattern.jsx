import Icon from './Icon.jsx';

/**
 * Adherence, broken out by weekday.
 *
 * The two-week percentage says you're at 60%. This says the misses are all
 * Fridays — which is the only version of the number you can do anything with,
 * because a weekday that keeps failing is a scheduling problem with a fix.
 *
 * Shows rates and averages, never a backlog. The moment this reads as "you owe
 * 14 calls" it becomes a debt, and debts get abandoned.
 */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function Bar({ pct }) {
  if (pct === null) {
    return <div className="h-2 rounded-full bg-slate-100" />;
  }
  const tone = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500';
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(pct, 2)}%` }} />
    </div>
  );
}

export default function WeekdayPattern({ pattern }) {
  if (!pattern.hasData) return null;

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
      <div className="mb-1 flex items-center gap-2 border-b border-slate-100 pb-3 font-bold text-slate-700">
        <Icon name="calendar-line" className="text-xl text-blue-600" />
        <h3>Which day slips</h3>
      </div>
      <p className="mb-3 pt-2 text-xs text-slate-500">
        How often the daily standard held, by weekday, over the last {pattern.weeks} weeks.
        Booked-off days aren&apos;t counted either way.
      </p>

      <div className="space-y-2.5">
        {pattern.days.map((day) => (
          <div key={day.day} className="grid grid-cols-[2.4rem_1fr_4.6rem] items-center gap-3">
            <span className="text-xs font-bold text-slate-600 uppercase">{DAYS[day.day]}</span>
            <Bar pct={day.pct} />
            <span className="text-right text-xs tabular-nums">
              {day.pct === null ? (
                <span className="text-slate-300">&mdash;</span>
              ) : (
                <>
                  <span className="font-bold text-slate-700">{day.pct}%</span>
                  <span className="text-slate-400">
                    {' '}
                    {day.met}/{day.owed}
                  </span>
                </>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
        {pattern.days
          .filter((d) => d.owed > 0)
          .map((day) => (
            <span key={day.day}>
              {DAYS[day.day]}{' '}
              <span className="font-bold tabular-nums text-slate-500">{day.avgTouches}</span> touches
              avg
            </span>
          ))}
      </div>

      {pattern.weakest && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="font-bold">{DAYS[pattern.weakest.day]} is the one to fix.</span> The
          standard held {pattern.weakest.pct}% of the time. Look at what&apos;s on that day&apos;s
          calendar before deciding it&apos;s a discipline problem &mdash; and if the day genuinely
          can&apos;t carry the block, book it off on purpose instead of missing it.
        </p>
      )}
    </section>
  );
}
