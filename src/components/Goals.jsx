import Icon from './Icon.jsx';
import { paceLabel } from '../lib/goals.js';

function Goal({ t }) {
  const pace = paceLabel(t);
  const pct = t.percent === null ? 0 : Math.min(100, t.percent);

  const bar = t.finished
    ? t.onTrack
      ? 'bg-emerald-500'
      : 'bg-slate-400'
    : t.onPace || t.onTrack
      ? 'bg-emerald-500'
      : 'bg-amber-500';

  const paceTone = t.finished
    ? t.onTrack
      ? 'text-emerald-700'
      : 'text-slate-500'
    : t.onPace
      ? 'text-slate-500'
      : t.onTrack
        ? 'text-emerald-700'
        : 'text-amber-700';

  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate font-medium text-slate-700">
          {t.goal.label}
          {!t.tracked && (
            <span
              title="You update this one — the app can't count it"
              className="ml-2 align-middle text-[10px] font-bold text-slate-400 uppercase"
            >
              manual
            </span>
          )}
        </p>
        <p className="shrink-0 text-sm tabular-nums">
          <span className="font-bold text-slate-800">{t.current}</span>
          {t.target > 0 && <span className="text-slate-400"> / {t.target}</span>}
        </p>
      </div>

      {t.target > 0 && (
        <>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px]">
            <span className={paceTone}>{pace}</span>
            <span className="text-slate-400">
              {t.finished
                ? 'period ended'
                : `${t.daysLeft} day${t.daysLeft === 1 ? '' : 's'} left`}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Goals, grouped by how far out they run.
 *
 * They used to live only in Settings, where you set them once and never saw
 * them again — which is most of why they felt pointless. An outcome you are not
 * looking at is not a goal, it is a note.
 */
export default function Goals({ groups, onEdit }) {
  if (!groups.length) {
    return (
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-bold text-blue-700">
          <Icon name="flag-line" className="text-xl" />
          <h3>Goals</h3>
        </div>
        <p className="pt-3 text-sm text-slate-500">
          Nothing set yet. A goal is an outcome over a period — 24 sides this year, two listings this
          month — and the app counts it for you from what you already log.
        </p>
        <button
          onClick={onEdit}
          className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
        >
          Set a goal
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 font-bold text-blue-700">
          <Icon name="flag-line" className="text-xl" />
          <h3>Goals</h3>
        </div>
        <button onClick={onEdit} className="text-xs font-bold text-blue-600 hover:underline">
          Edit
        </button>
      </div>

      {groups.map((group) => (
        <div key={group.key} className="mt-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase">{group.label}</p>
          <div className="divide-y divide-slate-50">
            {group.goals.map((t) => (
              <Goal key={t.goal.id} t={t} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
