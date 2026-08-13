import Icon from './Icon.jsx';

/**
 * Two streaks, and the order matters.
 *
 * The big number is days *logged* — showing up and being honest about the day.
 * That is the habit everything else depends on, and it is the one that needs
 * reinforcing in week one when it is most fragile.
 *
 * Hitting the daily standard is the harder, later thing, so it sits beneath as
 * a second tier. Counting only standard-met days meant a faithful logger who
 * was short of five calls saw a zero, which punished exactly the behaviour the
 * app exists to build.
 *
 * Weekends and booked days off never break either one. A streak that punishes
 * you for resting is one you stop caring about by week three.
 */
export default function StreakBadge({ logged, bestLogged, standard, bestStandard, metToday }) {
  const isBest = logged > 0 && logged >= bestLogged;

  const tone =
    logged === 0
      ? 'from-slate-400 to-slate-500'
      : isBest
        ? 'from-amber-500 to-orange-600'
        : 'from-orange-500 to-red-500';

  return (
    <section className={`rounded-2xl bg-linear-to-br ${tone} p-4 text-white shadow-sm`}>
      <div className="flex items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Icon name="fire-line" className="absolute text-4xl opacity-30" />
          <span className="relative text-2xl font-black tabular-nums">{logged}</span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-lg leading-tight font-bold">
            {logged === 0 ? 'No streak yet' : `${logged} day${logged === 1 ? '' : 's'} logged in a row`}
          </p>
          <p className="text-xs opacity-90">
            {logged === 0
              ? 'Log anything at all today to start one.'
              : isBest
                ? bestLogged > 1
                  ? 'Your best run yet — keep it.'
                  : 'Day one. Come back tomorrow.'
                : `Best so far: ${bestLogged} days.`}
          </p>
          {logged > 0 && !metToday && (
            <p className="mt-1 text-xs font-bold text-white/95">
              Today isn&apos;t logged yet — your run is safe until midnight.
            </p>
          )}
        </div>
      </div>

      {bestStandard > 0 && (
        <div className="mt-3 flex items-center gap-2 border-t border-white/20 pt-3 text-xs">
          <Icon name="award-line" className="shrink-0 text-base opacity-80" />
          <span className="opacity-95">
            {standard > 0 ? (
              <>
                <strong>{standard} in a row</strong> hitting your full daily standard
                {standard < bestStandard && ` · best ${bestStandard}`}
              </>
            ) : (
              <>
                Standard not hit yet this run — your best is <strong>{bestStandard}</strong> days.
              </>
            )}
          </span>
        </div>
      )}
    </section>
  );
}
