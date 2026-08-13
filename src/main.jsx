import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';

import App from './App.jsx';
import SharedView from './components/SharedView.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

window.__boot?.('render');

/**
 * One route, and it is deliberate: /s/<token> is the mentor's read-only view.
 * The token shape is checked here so a malformed URL shows the app rather than
 * a broken share screen, and nothing unvalidated reaches the API.
 */
const shared = window.location.pathname.match(/^\/s\/([0-9a-f]{32})\/?$/);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>{shared ? <SharedView token={shared[1]} /> : <App />}</ErrorBoundary>
  </StrictMode>
);

window.__boot?.('done');
