import Icon from './Icon.jsx';

const LABEL = {
  synced: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline — saved on this device',
  'signed-out': 'Not synced'
};

/**
 * Sign-in and sync status.
 *
 * Signing in is optional by design: the app is fully usable without an account,
 * so this never blocks anything. It only appears at all when the deployment has
 * sign-in configured.
 */
export default function AccountBar({ account, syncStatus, onSignIn, onSignOut }) {
  if (!account.configured) return null;

  if (!account.signedIn) {
    return (
      <button
        onClick={onSignIn}
        className="flex items-center gap-2 rounded-xl bg-white/20 px-3 py-2 text-sm font-medium transition-colors hover:bg-white/30"
      >
        <Icon name="group-line" className="text-lg" />
        <span className="hidden sm:inline">Sign in to sync</span>
        <span className="sm:hidden">Sync</span>
      </button>
    );
  }

  return (
    <button
      onClick={onSignOut}
      title={account.email ? `Signed in as ${account.email} — click to sign out` : 'Sign out'}
      className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-left transition-colors hover:bg-white/25"
    >
      <Icon
        name={syncStatus === 'syncing' ? 'loader-4-line' : 'check-line'}
        className={`text-lg ${syncStatus === 'syncing' ? 'animate-spin' : ''}`}
      />
      <span className="hidden leading-tight sm:block">
        <span className="block text-[10px] font-bold uppercase opacity-80">
          {LABEL[syncStatus] || 'Synced'}
        </span>
        <span className="block text-xs">{account.name || account.email}</span>
      </span>
    </button>
  );
}
