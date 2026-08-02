import Icon from './Icon.jsx';

export default function ActionPlan({ plan, onToggle, onChangeText }) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-xs">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2 font-bold text-indigo-600">
        <Icon name="list-check-2" className="text-xl" />
        <h2>Tomorrow&apos;s action plan</h2>
      </div>

      <div className="space-y-3">
        {plan.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <button
              onClick={() => onToggle(index)}
              aria-label={item.done ? `Mark target ${index + 1} incomplete` : `Mark target ${index + 1} complete`}
              className={`shrink-0 transition-colors ${
                item.done ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-400'
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
              placeholder={`Target #${index + 1}...`}
              className={`w-full rounded-xl border border-slate-200 p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden ${
                item.done ? 'bg-slate-100 text-slate-400 line-through' : 'bg-slate-50 text-slate-700'
              }`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
