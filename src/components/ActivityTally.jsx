import Icon from './Icon.jsx';

const TILES = [
  { label: 'Client check-ins', key: 'clientCheckIns', icon: 'group-line', accent: true },
  { label: 'Calls', key: 'calls', icon: 'phone-line' },
  { label: 'Texts', key: 'texts', icon: 'message-3-line' },
  { label: 'Notes', key: 'notes', icon: 'clipboard-line' }
];

export default function ActivityTally({ activities, onAdjust }) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-xs">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2 font-bold text-red-600">
        <Icon name="flashlight-line" className="text-xl" />
        <h2>Activity tally</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {TILES.map((tile) => (
          <div
            key={tile.key}
            className={`flex flex-col items-center rounded-xl border p-3 ${
              tile.accent ? 'border-amber-100 bg-amber-50' : 'border-slate-100 bg-slate-50'
            }`}
          >
            <span
              className={`mb-2 flex items-center gap-1 text-[10px] font-bold uppercase ${
                tile.accent ? 'text-amber-700' : 'text-slate-400'
              }`}
            >
              <Icon name={tile.icon} /> {tile.label}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onAdjust(tile.key, -1)}
                aria-label={`Decrease ${tile.label}`}
                className="p-1 text-slate-400 hover:text-red-500"
              >
                <Icon name="subtract-line" className="text-xl" />
              </button>
              <span className="w-8 text-center text-xl font-black text-slate-800">
                {activities[tile.key] || 0}
              </span>
              <button
                onClick={() => onAdjust(tile.key, 1)}
                aria-label={`Increase ${tile.label}`}
                className={`p-1 hover:scale-125 ${tile.accent ? 'text-amber-600' : 'text-blue-600'}`}
              >
                <Icon name="add-line" className="text-xl" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
