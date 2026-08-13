import Icon from './Icon.jsx';

/**
 * Notes left by whoever holds the share link.
 *
 * Read-only here on purpose: this is the other half of the accountability loop,
 * and the agent should not be able to quietly edit what their mentor said.
 */
export default function MentorNotes({ notes, lastSeenAt, onMarkSeen }) {
  if (!notes.length) return null;

  const unread = notes.filter((n) => Number(n.at) > Number(lastSeenAt || 0));

  return (
    <section className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-blue-100 pb-3">
        <div className="flex items-center gap-2 font-bold text-blue-800">
          <Icon name="sparkling-line" className="text-xl" />
          <h3>From your mentor</h3>
          {unread.length > 0 && (
            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
              {unread.length} new
            </span>
          )}
        </div>
        {unread.length > 0 && (
          <button onClick={onMarkSeen} className="text-xs font-bold text-blue-600 hover:underline">
            Mark read
          </button>
        )}
      </div>

      <div className="space-y-2">
        {notes.slice(0, 8).map((note) => {
          const isNew = Number(note.at) > Number(lastSeenAt || 0);
          return (
            <div
              key={note.id}
              className={`rounded-xl border p-3 ${
                isNew ? 'border-blue-200 bg-white' : 'border-transparent bg-white/60'
              }`}
            >
              <p className="text-[10px] font-bold text-slate-500 uppercase">
                {note.author} · {new Date(note.at).toLocaleDateString()}
              </p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
                {note.text}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
