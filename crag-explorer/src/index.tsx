import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { queryClient } from './api/queryClient';
import App from './App';
import './index.scss';

// Hosting also serves the app file at `/index.html`. Show the homepage route
// `/` instead, keeping the query and hash.
if (window.location.pathname === '/index.html') {
  const { search, hash } = window.location;
  window.history.replaceState(window.history.state, '', `/${search}${hash}`);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
