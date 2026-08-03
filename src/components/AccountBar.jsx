import { useState } from 'react';
import Icon from './Icon.jsx';
import { initials } from '../lib/format.js';

const LABEL = {
  synced: 'Synced',
  syncing: 'Syncing…',
  offline: 'Not connected',
  'signed-out': 'Not syncing',
  idle: 'Synced'
};

/**
 * Sign-in and sync status.
 *
 * The whole job of this control is to say WHO is signed in, so the identity is
 * visible at every width — an earlier version hid the name below 640px, which
 * left a bare tick mark that told you nothing.
 *
 * The Google avatar is the one image loaded from outside this app. It is
 * cosmetic and falls back to initials on any failure, so it cannot affect
 * whether the app works — unlike the CDN scripts this project exists to avoid.
 */
export default function AccountBar({ account, syncStatus, onSignIn, onSignOut }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!account.configured) return null;

  if (!account.signedIn) {
    return (
      <button
        onClick={onSignIn}
        className="flex items-center gap-2 rounded-xl bg-white/20 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-white/30"
      >
        <Icon name="group-line" className="text-lg" />
        Sign in
      </button>
    );
  }

  const showPicture = account.picture && !imageFailed;
  const label = LABEL[syncStatus] || 'Synced';

  return (
    <button
      onClick={onSignOut}
      title={`Signed in as ${account.email || account.name} — click to sign out`}
      className="flex items-center gap-2 rounded-xl bg-white/15 py-1.5 pr-3 pl-1.5 text-left transition-colors hover:bg-white/25"
    >
      <span className="relative shrink-0">
        {showPicture ? (
          <img
            src={account.picture}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="h-8 w-8 rounded-full bg-white/20 object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-xs font-bold">
            {initials(account.name, account.email)}
          </span>
        )}
        {syncStatus === 'syncing' && (
          <span className="absolute -right-0.5 -bottom-0.5 rounded-full bg-blue-700 p-0.5">
            <Icon name="loader-4-line" className="animate-spin text-[10px]" />
          </span>
        )}
      </span>

      <span className="leading-tight">
        <span className="block max-w-[9rem] truncate text-xs font-semibold">
          {account.name || account.email}
        </span>
        <span className="block text-[10px] opacity-80">{label}</span>
      </span>
    </button>
  );
}
