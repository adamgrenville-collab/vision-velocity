import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import { TextField, DerivedField, NumberField } from './Field.jsx';
import {
  deriveReview,
  activityLine,
  suggestedClosings,
  suggestedLeases,
  previousSession
} from '../lib/sessions.js';
import { buildFormAnswers, prefillUrl, plainText, missingAnswers, FIELD_ORDER } from '../lib/googleForm.js';
import { formatKey, todayKey } from '../lib/dates.js';
import { mindsetSummary, mindsetNarrative } from '../lib/mindset.js';
import MindsetReview from './MindsetReview.jsx';

function Card({ title, icon, accent, children, wide }) {
  return (
    <section
      className={`space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-xs ${
        wide ? 'lg:col-span-2' : ''
      }`}
    >
      <div className={`flex items-center gap-2 border-b border-slate-100 pb-3 font-bold ${accent}`}>
        <Icon name={icon} className="text-xl" />
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default function SessionPrep({
  session,
  sessions,
  entries,
  goals,
  name,
  onChange,
  onSetDate,
  onMarkSubmitted
}) {
  const [copied, setCopied] = useState(false);

  const review = useMemo(
    () => deriveReview(sessions, session, entries),
    [sessions, session, entries]
  );

  const answers = useMemo(
    () => buildFormAnswers({ session, review, goals, name }),
    [session, review, goals, name]
  );

  const mindset = useMemo(
    () => mindsetSummary(entries, review.windowKeys),
    [entries, review.windowKeys]
  );
  const mindsetLine = useMemo(() => mindsetNarrative(mindset), [mindset]);

  const missing = missingAnswers(answers);
  const prev = previousSession(sessions, session.date);
  const suggestedYtdClosings = suggestedClosings(entries, session.date);
  const suggestedYtdLeases = suggestedLeases(entries, session.date);

  const set = (path) => (value) => onChange(path, value);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(plainText(answers));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const labelFor = (key) => FIELD_ORDER.find((f) => f.key === key)?.label || key;

  return (
    <div className="space-y-5 pb-8">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Session prep</h2>
            <p className="text-sm text-slate-500">
              {prev
                ? `Covering the ${review.windowKeys.length} days since ${formatKey(prev.date)}`
                : `Covering the last ${review.windowKeys.length} days`}
              {' · '}
              logged {review.summary.daysLogged} of them
            </p>
          </div>
          <div>
            <label htmlFor="sessionDate" className="text-[10px] font-bold text-slate-500 uppercase">
              Next session
            </label>
            <input
              id="sessionDate"
              type="date"
              value={session.date}
              onChange={(e) => onSetDate(e.target.value)}
              className="mt-1 block rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Mindset check in" icon="emotion-line" accent="text-blue-800">
          <TextField
            label="How are you feeling today?"
            value={session.mindset.feeling}
            onChange={set('mindset.feeling')}
          />
          <TextField
            label="One win since last session"
            value={session.mindset.winSinceLastSession}
            onChange={set('mindset.winSinceLastSession')}
          />
          <TextField
            label="One thought or belief affecting your momentum"
            value={session.mindset.belief}
            onChange={set('mindset.belief')}
          />
        </Card>

        <MindsetReview summary={mindset} narrative={mindsetLine} />

        <Card title="Review of last session" icon="time-line" accent="text-indigo-600">
          <DerivedField
            label="What I committed to..."
            value={review.committedTo}
            note="Carried forward from your last session"
          />
          <TextField
            label="Progress made"
            hint="Leave blank to send the summary below"
            rows={4}
            placeholder={review.progressMade}
            value={session.review.progressMade}
            onChange={set('review.progressMade')}
          />
          {!session.review.progressMade && <DerivedField label="Will send" value={review.progressMade} />}
          <TextField
            label="What slowed me down?"
            hint="Leave blank to send the roadblocks you logged"
            placeholder={review.slowedDown || 'Nothing logged'}
            value={session.review.slowedDown}
            onChange={set('review.slowedDown')}
          />
        </Card>

        <Card title="Activity and production" icon="flashlight-line" accent="text-red-600" wide>
          <DerivedField
            label="Notes / Calls / Texts / Videos / Social Posts / Pop-Bys / Client Parties / Coffee"
            value={activityLine(review.summary)}
            note="Totalled from your nightly logs — nothing to add up"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumberField
              label="Active listings"
              value={session.production.activeListings}
              onChange={set('production.activeListings')}
              hint="Current count"
            />
            <NumberField
              label="Pendings"
              value={session.production.pendings}
              onChange={set('production.pendings')}
              hint="Current count"
            />
            <NumberField
              label="Closings YTD"
              value={session.production.closings}
              onChange={set('production.closings')}
              hint={`Logged this year: ${suggestedYtdClosings}`}
            />
            <NumberField
              label="Leases YTD"
              value={session.production.leases}
              onChange={set('production.leases')}
              hint={`Logged this year: ${suggestedYtdLeases}`}
            />
          </div>
          <TextField
            label="Progress toward goals"
            hint="Leave blank to send your goals from settings"
            placeholder={answers.progressTowardGoals || 'Add goals in settings'}
            value={session.goalsNote}
            onChange={set('goalsNote')}
          />
        </Card>

        <Card title="Pipeline focus" icon="bar-chart-box-line" accent="text-emerald-700">
          <TextField
            label="Top opportunities"
            value={session.pipeline.topOpportunities}
            onChange={set('pipeline.topOpportunities')}
          />
          <TextField
            label="What I need to act on"
            value={session.pipeline.whatToActOn}
            onChange={set('pipeline.whatToActOn')}
          />
          <TextField
            label="Next steps and timing"
            value={session.pipeline.nextSteps}
            onChange={set('pipeline.nextSteps')}
          />
        </Card>

        <Card title="Action plan" icon="list-check-2" accent="text-amber-600">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Three clear actions</label>
            {session.commitments.map((item, index) => (
              <input
                key={index}
                type="text"
                value={item.text}
                onChange={(e) => onChange(`commitments.${index}.text`, e.target.value)}
                placeholder={`Action ${index + 1}...`}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            ))}
            <p className="text-[10px] text-slate-400">
              These become "what I committed to" at your next session.
            </p>
          </div>
          <TextField
            label="Support needed"
            value={session.supportNeeded}
            onChange={set('supportNeeded')}
          />
          <TextField label="Notes" value={session.notes} onChange={set('notes')} />
        </Card>

        <Card title="Send to your broker" icon="send-plane-fill" accent="text-blue-700" wide>
          {missing.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-bold">
                {missing.length} {missing.length === 1 ? 'answer is' : 'answers are'} still blank
              </p>
              <p className="mt-1 text-xs">
                Every field on his form is required: {missing.map(labelFor).join(', ')}
              </p>
            </div>
          )}

          <p className="text-sm text-slate-600">
            Opens your broker's own Google Form with every answer already filled in. Review it, then
            submit as normal — nothing changes on his end.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href={prefillUrl(answers)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onMarkSubmitted}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Icon name="send-plane-fill" className="text-lg" />
              Open prefilled form
            </a>
            <button
              onClick={copyText}
              className="flex items-center gap-2 rounded-xl bg-slate-100 px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-200"
            >
              <Icon name={copied ? 'check-line' : 'clipboard-line'} className="text-lg" />
              {copied ? 'Copied' : 'Copy as text'}
            </button>
          </div>
        </Card>

        <Card title="After the session" icon="sparkling-line" accent="text-slate-700" wide>
          <p className="text-sm text-slate-500">
            Fill these in together during the meeting — they stay in the app for your own tracking and
            never go on the form.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <TextField
              label="Broker feedback"
              rows={4}
              placeholder="What he told you"
              value={session.brokerFeedback}
              onChange={set('brokerFeedback')}
            />
            <TextField
              label="My takeaways"
              rows={4}
              placeholder="What you're taking away from it"
              value={session.myTakeaways}
              onChange={set('myTakeaways')}
            />
          </div>
        </Card>
      </div>

      {session.date < todayKey() && (
        <p className="px-1 text-center text-xs text-slate-400">
          This session date has passed. Set your next one at the top to start a fresh cycle.
        </p>
      )}
    </div>
  );
}
