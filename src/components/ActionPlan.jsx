import Icon from './Icon.jsx';

/**
 * Three commitments, matching the coaching form.
 *
 * A plan belongs to the day it is FOR, not the day it was written. That is the
 * whole fix: the old version filed "Tomorrow's plan" under tonight's date, so
 * the next morning it was nowhere to be seen. Now tonight you edit tomorrow's
 * entry directly, and tomorrow it is the first thing on screen.
 */
export default function ActionPlan({ title, subtitle, icon, accent, plan, onToggle, onChangeText, emptyHint }) {
  const isEmpty = plan.every((item) => !item.text);

  return (
    <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
      <div className="border-b border-slate-100 pb-3">
        <div className={`flex items-center gap-2 font-bold ${accent}`}>
          <Icon name={icon} className="text-xl" />
          <h2>{title}</h2>
        </div>
        {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      </div>

      {isEmpty && emptyHint && <p className="text-sm text-slate-400 italic">{emptyHint}</p>}

      {plan.map((item, index) => (
        <div key={index} className="flex items-center gap-3">
          <button
            onClick={() => onToggle(index)}
            disabled={!item.text}
            aria-label={
              item.done ? `Mark action ${index + 1} incomplete` : `Mark action ${index + 1} complete`
            }
            className={`shrink-0 transition-colors disabled:opacity-30 ${
              item.done ? 'text-emerald-500' : 'text-slate-300'
            }`}
          >
            <Icon
              name={item.done ? 'checkbox-circle-fill' : 'checkbox-blank-circle-line'}
              className="text-2xl"
            />
          </button>
          <input
            type="text"
            value={item.text}
            onChange={(e) => onChangeText(index, e.target.value)}
            placeholder={`Action ${index + 1}...`}
            className={`w-full rounded-xl border border-slate-200 p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden ${
              item.done ? 'bg-slate-100 text-slate-400 line-through' : 'bg-slate-50 text-slate-700'
            }`}
          />
        </div>
      ))}
    </section>
  );
}
