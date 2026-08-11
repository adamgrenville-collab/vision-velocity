import Icon from './Icon.jsx';

/**
 * The streak, given the room it deserves.
 *
 * It was a small line inside the standards panel. A run of days you do not want
 * to break is the single strongest reason to open the app at 10pm when you
 * cannot be bothered, so it gets to be the first thing on the screen.
 *
 * Weekends and booked days off never break it — see dailyStreak. That matters:
 * a streak that punishes you for resting is one you stop caring about by week
 * three.
 */
export default function StreakBadge({ current: streak, best, metToday }) {
  const isBest = streak > 0 && streak >= best;

  const tone = streak === 0
    ? 'from-slate-400 to-slate-500'
    : isBest
      ? 'from-amber-500 to-orange-600'
      : 'from-orange-500 to-red-500';

  return (
    <section
      className={`flex items-center gap-4 rounded-2xl bg-linear-to-br ${tone} p-4 text-white shadow-sm`}
    >
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20">
        <Icon name="fire-line" className="absolute text-4xl opacity-30" />
        <span className="relative text-2xl font-black tabular-nums">{streak}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-lg leading-tight font-bold">
          {streak === 0
            ? 'No streak yet'
            : `${streak} day${streak === 1 ? '' : 's'} in a row`}
        </p>
        <p className="text-xs opacity-90">
          {streak === 0
            ? 'Hit your daily standard to start one.'
            : isBest
              ? best > 1
                ? 'Your best run yet — keep it.'
                : 'Day one. Come back tomorrow.'
              : `Best so far: ${best} days.`}
        </p>
        {streak > 0 && !metToday && (
          <p className="mt-1 text-xs font-bold text-white/95">
            Today isn&apos;t logged yet — your run is still safe until midnight.
          </p>
        )}
      </div>
    </section>
  );
}
