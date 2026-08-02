import Icon from './Icon.jsx';

export default function MindsetCheckIn({ mindset, onChange, onReframe, onDraftPost, isAiLoading, aiResponse }) {
  const showResponse = aiResponse.content && (aiResponse.type === 'mindset' || aiResponse.type === 'social');

  return (
    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2 font-bold text-blue-800">
          <Icon name="emotion-line" className="text-xl" />
          <h2>Mindset check-in</h2>
        </div>
        <button
          onClick={onReframe}
          disabled={isAiLoading || !mindset.feeling}
          className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          <Icon
            name={isAiLoading ? 'loader-4-line' : 'sparkling-line'}
            className={isAiLoading ? 'animate-spin' : ''}
          />
          Reframe day
        </button>
      </div>

      <div>
        <label htmlFor="feeling" className="text-[10px] font-bold text-slate-500 uppercase">
          Feeling?
        </label>
        <input
          id="feeling"
          type="text"
          value={mindset.feeling}
          onChange={(e) => onChange('feeling', e.target.value)}
          placeholder="How's your head space?"
          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
        />
      </div>

      <div>
        <div className="flex items-end justify-between">
          <label htmlFor="win" className="text-[10px] font-bold text-slate-500 uppercase">
            One win today?
          </label>
          <button
            onClick={onDraftPost}
            disabled={isAiLoading || !mindset.win}
            className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline disabled:opacity-50"
          >
            <Icon name="sparkling-line" /> Draft social post
          </button>
        </div>
        <input
          id="win"
          type="text"
          value={mindset.win}
          onChange={(e) => onChange('win', e.target.value)}
          placeholder="What went right?"
          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
        />
      </div>

      {showResponse && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-800 uppercase">
            <Icon name="sparkling-line" /> Coach
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">{aiResponse.content}</p>
        </div>
      )}
    </section>
  );
}
