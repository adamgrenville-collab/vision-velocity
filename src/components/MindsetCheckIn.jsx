import Icon from './Icon.jsx';

/**
 * Fields mirror the coaching form's Mindset Check In, plus "what slowed me
 * down" — which the form asks for per session, and which is far easier to
 * answer honestly on the night than reconstructed a fortnight later.
 */
const FIELDS = [
  { key: 'feeling', label: 'How are you feeling?', placeholder: "Where's your head at?" },
  { key: 'win', label: 'One win today', placeholder: 'What went right?' },
  { key: 'roadblock', label: 'What slowed me down', placeholder: 'What got in the way?' }
];

export default function MindsetCheckIn({ mindset, onChange, onReframe, isAiLoading, aiResponse }) {
  const showResponse = aiResponse.content && (aiResponse.type === 'mindset' || aiResponse.type === 'social');

  return (
    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 font-bold text-blue-800">
          <Icon name="emotion-line" className="text-xl" />
          <h2>Mindset check-in</h2>
        </div>
        <button
          onClick={onReframe}
          disabled={isAiLoading || !mindset.feeling}
          className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-40"
        >
          <Icon
            name={isAiLoading ? 'loader-4-line' : 'sparkling-line'}
            className={isAiLoading ? 'animate-spin' : ''}
          />
          Reframe
        </button>
      </div>

      {FIELDS.map((field) => (
        <div key={field.key}>
          <label htmlFor={field.key} className="text-[10px] font-bold text-slate-500 uppercase">
            {field.label}
          </label>
          <input
            id={field.key}
            type="text"
            value={mindset[field.key]}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>
      ))}

      {showResponse && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-800 uppercase">
            <Icon name="sparkling-line" /> Coach
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">{aiResponse.content}</p>
        </div>
      )}
    </section>
  );
}
