import { formatKey, todayKey } from '../lib/dates.js';
import Icon from './Icon.jsx';

export default function DateNav({ dateKey, onShift, onToday }) {
  const isToday = dateKey === todayKey();

  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-3 shadow-xs">
      <button
        onClick={() => onShift(-1)}
        aria-label="Previous day"
        className="rounded-full p-2 transition-colors hover:bg-slate-50"
      >
        <Icon name="arrow-left-s-line" className="text-xl text-slate-400" />
      </button>

      <button
        onClick={onToday}
        disabled={isToday}
        className="flex items-center gap-2 font-semibold text-slate-700 disabled:cursor-default"
      >
        <Icon name="calendar-line" className="text-xl text-blue-600" />
        <span>{formatKey(dateKey)}</span>
        {!isToday && <span className="text-[10px] font-bold text-blue-600 uppercase">Today</span>}
      </button>

      <button
        onClick={() => onShift(1)}
        aria-label="Next day"
        className="rounded-full p-2 transition-colors hover:bg-slate-50"
      >
        <Icon name="arrow-right-s-line" className="text-xl text-slate-400" />
      </button>
    </div>
  );
}
