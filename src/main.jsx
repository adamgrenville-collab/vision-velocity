import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';

import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

window.__boot?.('render');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

window.__boot?.('done');
