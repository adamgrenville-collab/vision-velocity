import Icon from './Icon.jsx';
import { ACTIVITY_ITEMS } from './CounterList.jsx';

/**
 * The standards panel: what was promised, and how much of it is done.
 *
 * It sits above the counters on the daily screen because the question it
 * answers — "am I done?" — is the reason the screen gets opened at all. The
 * daily row is deliberately blunt: three chips, met or not met, no partial
 * credit. The weekly bars are the softer half, since quota work is lumpy.
 *
 * Nothing here is editable. Adjusting a number is a coaching decision, so it
 * lives in Settings rather than one thumb-slip away from the counters.
 */

const ITEM = Object.fromEntries(ACTIVITY_ITEMS.map((i) => [i.key, i]));

/** "calls" but "call" for one — the counter labels are all plural on the form. */
function plural(key, count) {
  const label = (ITEM[key]?.label || key).toLowerCase();
  return count === 1 && label.endsWith('s') ? label.slice(0, -1) : label;
}

const owedPhrase = (item) => `${item.remaining} ${plural(item.key, item.remaining)}`;

function DailyChip({ item }) {
  const { label, icon } = ITEM[item.key] || { label: item.key, icon: 'checkbox-blank-circle-line' };
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-3 transition-colors ${
        item.met ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
      }`}
    >
      <Icon name={item.met ? 'check-line' : icon} className="text-xl" />
      <p className="text-lg leading-none font-black tabular-nums">
        {item.done}
        <span className={item.met ? 'opacity-70' : 'text-slate-400'}>/{item.target}</span>
      </p>
      <p className="text-[10px] font-bold uppercase opacity-80">{label}</p>
    </div>
  );
}

function WeeklyRow({ item }) {
  const { label, icon } = ITEM[item.key] || { label: item.key, icon: 'checkbox-blank-circle-line' };
  const complete = item.done >= item.target;
  const bar = complete ? 'bg-emerald-500' : item.onPace ? 'bg-blue-500' : 'bg-amber-500';

  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="flex min-w-0 items-center gap-2 text-slate-600">
          <Icon name={icon} className="text-lg text-slate-300" />
          <span className="truncate">{label}</span>
        </span>
        <span className="shrink-0 tabular-nums">
          <span className="font-bold text-slate-800">{item.done}</span>
          <span className="text-slate-400">/{item.target}</span>
          {!item.onPace && (
            <span className="ml-2 text-xs font-bold text-amber-600">{item.owed - item.done} behind</span>
          )}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${item.pct}%` }} />
      </div>
    </div>
  );
}

export default function Standards({
  daily,
  weekly,
  streak,
  adherence,
  isToday,
  isWeekend,
  dayOff,
  onToggleDayOff,
  onEdit
}) {
  const remaining = daily.items.filter((i) => !i.met);
  // Nothing is owed on a weekend or a booked-off day. Anything logged on one is
  // credit, never a debt, and the copy has to say so plainly.
  const owed = !isWeekend && !dayOff;
  const label = dayOff ? 'Booked off' : isWeekend ? 'Weekend · not owed' : 'Non-negotiable';

  return (
    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 font-bold text-slate-700">
          <Icon name="shield-star-line" className="text-xl text-blue-600" />
          <h2>Standards</h2>
        </div>
        <button
          onClick={onEdit}
          className="rounded-lg px-2 py-1 text-xs font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-600"
        >
          Edit
        </button>
      </div>

      {daily.items.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-500 uppercase">
              {isToday ? 'Today' : 'That day'} · {label}
            </p>
            {streak > 0 && (
              <p className="flex items-center gap-1 text-xs font-bold text-amber-600">
                <Icon name="fire-line" className="text-sm" />
                {streak} day{streak === 1 ? '' : 's'}
              </p>
            )}
          </div>

          {dayOff && !daily.met ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-5 text-center">
              <Icon name="moon-line" className="text-2xl text-slate-400" />
              <p className="mt-1 text-sm font-bold text-slate-600">Booked off. Not a miss.</p>
              <p className="text-xs text-slate-500">
                This day is out of the week's total and off your adherence score.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {daily.items.map((item) => (
                  <DailyChip key={item.key} item={item} />
                ))}
              </div>

              <p className="mt-2 text-center text-xs text-slate-500">
                {daily.met ? (
                  <span className="font-bold text-emerald-700">
                    {owed ? 'Standard met. The day counts.' : 'Met on a day you owed nothing. Banked.'}
                  </span>
                ) : owed ? (
                  <>
                    Still owed:{' '}
                    <span className="font-bold text-slate-700">
                      {remaining.map(owedPhrase).join(', ')}
                    </span>
                  </>
                ) : (
                  <span>Anything logged here counts toward the week. Nothing is owed.</span>
                )}
              </p>
            </>
          )}

          {!isWeekend && (
            <button
              onClick={onToggleDayOff}
              className="mx-auto mt-2 block rounded-lg px-3 py-1 text-xs font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            >
              {dayOff ? 'Actually, I worked this day' : 'Book this day off'}
            </button>
          )}
        </div>
      )}

      {weekly.items.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-500 uppercase">
              This week · day {weekly.elapsed} of {weekly.owedDays}
              {weekly.daysOff > 0 && ` · ${weekly.daysOff} off`}
            </p>
            <p
              className={`text-xs font-bold ${weekly.onPace ? 'text-emerald-600' : 'text-amber-600'}`}
            >
              {weekly.complete
                ? 'Week complete'
                : weekly.onPace
                  ? 'On pace'
                  : `${weekly.behind.length} behind pace`}
            </p>
          </div>
          {weekly.items.map((item) => (
            <WeeklyRow key={item.key} item={item} />
          ))}

          {weekly.complete && (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <Icon name="check-line" className="shrink-0 text-base" />
              <span>
                <span className="font-bold">Every quota hit.</span> However the week was shaped, the
                work is done.
              </span>
            </p>
          )}

          {weekly.toFinish.length > 0 && (
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span className="font-bold text-slate-700">To finish the week:</span>{' '}
              {weekly.toFinish.map((i) => `${i.remaining} ${plural(i.key, i.remaining)}`).join(', ')}.
              Quotas can be batched — these are still catchable.
            </p>
          )}
        </div>
      )}

      {(adherence.owed > 0 || adherence.daysOff > 0) && (
        <p className="border-t border-slate-100 pt-3 text-center text-xs text-slate-400">
          Last two weeks: standard met{' '}
          <span className="font-bold text-slate-600">
            {adherence.met} of {adherence.owed}
          </span>{' '}
          working days ({adherence.pct}%)
          {adherence.bonus > 0 && (
            <span className="text-emerald-600"> · +{adherence.bonus} unowed</span>
          )}
          {adherence.daysOff > 0 && ` · ${adherence.daysOff} booked off`}
        </p>
      )}
    </section>
  );
}
