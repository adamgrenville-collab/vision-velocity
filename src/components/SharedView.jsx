import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { fetchShared, postNote } from '../lib/sync.js';
import { formatKey } from '../lib/dates.js';

const shortDate = (key) => String(key).slice(5).replace('-', '/');

function Stat({ label, value, sub, tone = 'bg-slate-700' }) {
  return (
    <div className={`rounded-2xl p-4 text-white ${tone}`}>
      <p className="text-[10px] font-bold uppercase opacity-80">{label}</p>
      <p className="text-3xl font-black tabular-nums">{value}</p>
      {sub && <p className="text-[10px] opacity-80">{sub}</p>}
    </div>
  );
}

function Card({ title, icon, accent, children }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
      <div className={`flex items-center gap-2 border-b border-slate-100 pb-3 font-bold ${accent}`}>
        <Icon name={icon} className="text-xl" />
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function NoteForm({ token, onPosted }) {
  const [author, setAuthor] = useState(() => localStorage.getItem('vv_mentor_name') || '');
  const [text, setText] = useState('');
  const [state, setState] = useState('idle');

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setState('sending');
    try {
      const { note } = await postNote(token, author, text);
      localStorage.setItem('vv_mentor_name', author.trim());
      setText('');
      setState('sent');
      onPosted(note);
      setTimeout(() => setState('idle'), 2500);
    } catch (error) {
      setState(error.status === 429 ? 'rate' : 'failed');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        type="text"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Your name"
        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
      />
      <textarea
        value={text}
        rows={3}
        onChange={(e) => setText(e.target.value)}
        placeholder="Leave a note — encouragement, a nudge, something to work on before the next session."
        className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!text.trim() || state === 'sending'}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-40"
        >
          <Icon name={state === 'sending' ? 'loader-4-line' : 'send-plane-fill'} className={state === 'sending' ? 'animate-spin' : ''} />
          Send
        </button>
        {state === 'sent' && <span className="text-sm font-medium text-emerald-700">Sent.</span>}
        {state === 'rate' && (
          <span className="text-sm text-amber-700">That's plenty of notes for today.</span>
        )}
        {state === 'failed' && (
          <span className="text-sm text-amber-700">Didn't send — try again in a moment.</span>
        )}
      </div>
    </form>
  );
}

/**
 * What a mentor sees. No account, no sign-in — the link is the authorisation.
 *
 * Read-only apart from leaving notes. Everything here was assembled server-side
 * from the agent's own log, including the nightly mindset check-ins, which they
 * chose to share.
 */
export default function SharedView({ token }) {
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchShared(token)
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setState('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setState(error.status === 404 ? 'gone' : 'failed');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === 'loading') {
    return <p className="p-10 text-center text-slate-500">Loading…</p>;
  }

  if (state === 'gone') {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <Icon name="alert-line" className="text-4xl text-amber-500" />
        <h1 className="mt-3 text-xl font-bold text-slate-800">This link isn't active</h1>
        <p className="mt-2 text-sm text-slate-500">
          It may have been turned off or replaced. Ask for a new one.
        </p>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-bold text-slate-800">Couldn't load this right now</h1>
        <p className="mt-2 text-sm text-slate-500">Try refreshing in a moment.</p>
      </div>
    );
  }

  const { snapshot: s } = data;
  const notes = data.notes || [];
  const followThrough =
    s.commitments.set > 0 ? Math.round((s.commitments.done / s.commitments.set) * 100) : null;

  return (
    <div className="app-container text-slate-900">
      <header className="bg-linear-to-r from-indigo-600 to-blue-800 p-6 pt-10 text-white shadow-lg">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-bold tracking-widest uppercase opacity-80">Vision &amp; Velocity</p>
          <h1 className="text-2xl font-bold">{s.name || 'An agent'}</h1>
          <p className="text-sm text-blue-100">
            {s.cycle.previousSession
              ? `Since ${formatKey(s.cycle.previousSession)}`
              : `Last ${s.cycle.days} days`}
            {' · '}logged {s.cycle.daysLogged} of {s.cycle.days} days
            {s.cycle.nextSession && ` · next session ${formatKey(s.cycle.nextSession)}`}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 p-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Conversations" value={s.conversations} sub="calls + texts" tone="bg-blue-600" />
          <Stat label="All activity" value={s.totalActivity} sub="every touch" tone="bg-indigo-600" />
          <Stat
            label="Follow-through"
            value={followThrough === null ? '—' : `${followThrough}%`}
            sub={`${s.commitments.done} of ${s.commitments.set} daily actions`}
            tone="bg-emerald-600"
          />
          <Stat
            label="Consistency"
            value={`${s.cycle.daysLogged}/${s.cycle.days}`}
            sub="nights logged"
            tone={s.cycle.daysLogged >= s.cycle.days * 0.7 ? 'bg-emerald-600' : 'bg-amber-500'}
          />
        </div>

        <Card title="Leave a note" icon="sparkling-line" accent="text-blue-700">
          <p className="text-sm text-slate-500">
            This appears in {s.name ? s.name.split(' ')[0] : 'their'} app. They'll see it next time
            they open it.
          </p>
          <NoteForm token={token} onPosted={(note) => setData((d) => ({ ...d, notes: [note, ...(d.notes || [])] }))} />

          {notes.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Earlier notes</p>
              {notes.slice(0, 5).map((note) => (
                <div key={note.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">
                    {note.author} · {new Date(note.at).toLocaleDateString()}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">{note.text}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {s.commitments.lastSession.length > 0 && (
          <Card title="What they committed to last session" icon="list-check-2" accent="text-amber-600">
            <ul className="space-y-2">
              {s.commitments.lastSession.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Icon
                    name={c.done ? 'checkbox-circle-fill' : 'checkbox-blank-circle-line'}
                    className={`mt-0.5 ${c.done ? 'text-emerald-500' : 'text-slate-300'}`}
                  />
                  <span className={c.done ? 'text-slate-500 line-through' : 'text-slate-700'}>
                    {c.text}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {s.mindset.checkedIn > 0 && (
          <Card title="Mindset" icon="emotion-line" accent="text-blue-800">
            <p className="text-sm leading-relaxed text-slate-700">{s.mindset.narrative}</p>

            {s.mindset.effect && (
              <div
                className={`rounded-xl border p-3 text-sm ${
                  s.mindset.effect.changePercent < 0
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                }`}
              >
                On the {s.mindset.effect.blockedDays} days something was in the way they averaged{' '}
                <strong>{s.mindset.effect.blockedMean}</strong> touches, against{' '}
                <strong>{s.mindset.effect.clearMean}</strong> on the {s.mindset.effect.clearDays}{' '}
                clear days.
              </div>
            )}

            {s.mindset.themes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {s.mindset.themes.map((t) => (
                  <span key={t.word} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                    {t.word} <span className="text-slate-400">×{t.days}</span>
                  </span>
                ))}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ['Wins', s.mindset.wins, 'text-emerald-800'],
                ['What slowed them down', s.mindset.roadblocks, 'text-amber-900'],
                ['How they felt', s.mindset.feelings, 'text-slate-600']
              ].map(([label, items, tone]) =>
                items.length ? (
                  <div key={label}>
                    <p className="mb-1 text-[10px] font-bold text-slate-500 uppercase">{label}</p>
                    <ul className="space-y-1">
                      {items.map((item) => (
                        <li key={item.date} className="flex gap-2 text-sm">
                          <span className="shrink-0 font-mono text-xs text-slate-400">
                            {shortDate(item.date)}
                          </span>
                          <span className={tone}>{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null
              )}
            </div>
          </Card>
        )}

        {s.goals.length > 0 && (
          <Card title="Goals" icon="flag-line" accent="text-blue-700">
            {s.goals.map((group) => (
              <div key={group.key}>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{group.label}</p>
                {group.goals.map((g) => (
                  <div key={g.label} className="flex items-baseline justify-between gap-3 py-1 text-sm">
                    <span className="text-slate-700">{g.label}</span>
                    <span className="tabular-nums">
                      <strong>{g.current}</strong>
                      {g.target > 0 && <span className="text-slate-400"> / {g.target}</span>}
                      {g.target > 0 && (
                        <span
                          className={`ml-2 text-xs ${
                            g.onPace || g.onTrack ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {g.finished
                            ? g.onTrack
                              ? 'hit'
                              : 'missed'
                            : g.onPace
                              ? 'on pace'
                              : g.onTrack
                                ? `${g.deltaWhole} ahead`
                                : `${g.deltaWhole} behind`}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </Card>
        )}

        <p className="pb-6 text-center text-xs text-slate-400">
          Shared by {s.name || 'the agent'}, who can turn this link off at any time.
        </p>
      </main>
    </div>
  );
}
