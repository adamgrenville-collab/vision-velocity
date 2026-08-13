import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { getShare, createShare, revokeShare } from '../lib/sync.js';

/**
 * Turning the mentor link on and off.
 *
 * The link carries everything, mindset included, and says so here rather than
 * in small print. Someone reading how you felt at 10pm should be a decision you
 * made on purpose.
 */
export default function ShareSettings({ signedIn }) {
  const [share, setShare] = useState({ sharing: false, token: null });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  useEffect(() => {
    if (signedIn) getShare().then(setShare);
  }, [signedIn]);

  if (!signedIn) {
    return (
      <div className="mb-5">
        <label className="text-[10px] font-bold text-slate-500 uppercase">Share with a mentor</label>
        <p className="mt-1 text-xs text-slate-500">
          Sign in first — a share link needs an account to belong to.
        </p>
      </div>
    );
  }

  const url = share.token ? `${window.location.origin}/s/${share.token}` : '';

  const act = async (fn) => {
    setBusy(true);
    const result = await fn();
    if (result) setShare(result);
    setBusy(false);
    setConfirmingRevoke(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mb-5">
      <label className="text-[10px] font-bold text-slate-500 uppercase">Share with a mentor</label>

      {!share.sharing ? (
        <>
          <p className="mt-1 mb-2 text-xs text-slate-500">
            Creates a private link your broker can open — no account needed on their end. They see
            your activity, goals, commitments <strong>and your nightly mindset check-ins</strong>,
            and can leave you notes. You can switch it off at any time.
          </p>
          <button
            type="button"
            onClick={() => act(createShare)}
            disabled={busy}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {busy ? 'Creating…' : 'Create a link'}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 mb-2 text-xs text-slate-500">
            Anyone with this link can see everything and leave notes. Send it to your broker only.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono text-xs"
            />
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => act(createShare)}
              disabled={busy}
              className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
            >
              Replace with a new link
            </button>

            {confirmingRevoke ? (
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => act(revokeShare)}
                  disabled={busy}
                  className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                >
                  Yes, turn it off
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRevoke(false)}
                  className="text-xs font-bold text-slate-500"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingRevoke(true)}
                className="rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
              >
                Turn sharing off
              </button>
            )}
          </div>

          <p className="mt-2 flex items-start gap-1 text-[10px] text-slate-400">
            <Icon name="alert-line" className="mt-0.5 shrink-0" />
            Replacing the link stops the old one working immediately — you'd need to send the new one.
          </p>
        </>
      )}
    </div>
  );
}
