import { Component } from 'react';
import { remove, KEYS } from '../lib/storage.js';

/**
 * React unmounts the entire tree when a render throws, which is what turns a
 * component bug into a blank white screen. This catches it and shows the stack
 * instead — on a phone that is the only way to see what happened.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Render crash:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-red-50 p-6 text-sm">
        <h2 className="mb-3 text-xl font-bold text-red-800">Something broke while drawing the screen</h2>
        <pre className="overflow-x-auto rounded-xl border border-red-200 bg-white p-4 text-xs whitespace-pre-wrap break-words text-red-900">
          {String(this.state.error?.stack || this.state.error)}
        </pre>
        <p className="mt-4 text-red-900">
          Your saved days are still on this device. Clearing them is a last resort.
        </p>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-slate-800 px-5 py-3 font-bold text-white"
          >
            Reload
          </button>
          <button
            onClick={() => {
              remove(KEYS.entries);
              window.location.reload();
            }}
            className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white"
          >
            Clear saved days
          </button>
        </div>
      </div>
    );
  }
}
