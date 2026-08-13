import Icon from './Icon.jsx';

/**
 * A one-off prompt to set a phone alarm.
 *
 * The app deliberately does not send notifications: on iPhone they only work
 * for a home-screen install, they expire silently, and a repeating alarm is
 * simply more reliable than anything a web page can do. So rather than build
 * something fragile, this asks once and gets out of the way.
 *
 * Shown only once there is a habit worth protecting — nagging someone on day
 * one is how a tool gets deleted.
 */
export default function AlarmNudge({ onDismiss }) {
  return (
    <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <Icon name="time-line" className="mt-0.5 shrink-0 text-xl text-amber-600" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-amber-900">Set a nightly alarm</p>
        <p className="mt-1 text-sm text-amber-900/90">
          You've logged a few days now. A repeating alarm on your phone — whenever you're realistically
          done, not when you intend to be — is the thing that makes this stick.
        </p>
        <button
          onClick={onDismiss}
          className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
        >
          Done, don't show this again
        </button>
      </div>
    </section>
  );
}
