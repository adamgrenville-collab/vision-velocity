import Icon from './Icon.jsx';

/**
 * Full-width counter rows. Deliberately not a grid: the coaching form has eight
 * activity types, and eight tiles two-up is four rows of squinting. Rows give
 * each label room and put the +/- buttons in the same place every time, which
 * is what makes a nightly log take twenty seconds on a phone.
 */
export default function CounterList({ title, icon, accent, items, values, onAdjust }) {
  return (
    <section className="space-y-1 rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
      <div className={`flex items-center gap-2 border-b border-slate-100 pb-3 font-bold ${accent}`}>
        <Icon name={icon} className="text-xl" />
        <h2>{title}</h2>
      </div>

      {items.map((item) => {
        const value = values[item.key] || 0;
        return (
          <div
            key={item.key}
            className="flex items-center justify-between border-b border-slate-50 py-2 last:border-0"
          >
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-600">
              <Icon name={item.icon} className={`text-lg ${value > 0 ? accent : 'text-slate-300'}`} />
              <span className="truncate">{item.label}</span>
            </span>

            <span className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => onAdjust(item.key, -1)}
                disabled={value === 0}
                aria-label={`Decrease ${item.label}`}
                className="rounded-full p-2 text-slate-400 active:bg-slate-100 disabled:opacity-25"
              >
                <Icon name="subtract-line" className="text-lg" />
              </button>

              <span
                className={`w-7 text-center text-lg font-black tabular-nums ${
                  value > 0 ? 'text-slate-800' : 'text-slate-300'
                }`}
              >
                {value}
              </span>

              <button
                onClick={() => onAdjust(item.key, 1)}
                aria-label={`Increase ${item.label}`}
                className={`rounded-full p-2 active:bg-slate-100 ${accent}`}
              >
                <Icon name="add-line" className="text-lg" />
              </button>
            </span>
          </div>
        );
      })}
    </section>
  );
}

/** Order and labels come straight off the coaching form. */
export const ACTIVITY_ITEMS = [
  { key: 'notes', label: 'Notes', icon: 'clipboard-line' },
  { key: 'calls', label: 'Calls', icon: 'phone-line' },
  { key: 'texts', label: 'Texts', icon: 'message-3-line' },
  { key: 'videos', label: 'Videos', icon: 'vidicon-line' },
  { key: 'socialPosts', label: 'Social posts', icon: 'megaphone-line' },
  { key: 'popBys', label: 'Pop-bys', icon: 'home-smile-line' },
  { key: 'clientParties', label: 'Client parties', icon: 'cake-2-line' },
  { key: 'coffee', label: 'Coffee', icon: 'cup-line' }
];

export const PRODUCTION_ITEMS = [
  { key: 'listings', label: 'Listings', icon: 'home-4-line' },
  { key: 'pendings', label: 'Pendings', icon: 'time-line' },
  { key: 'closings', label: 'Closings', icon: 'award-line' }
];
