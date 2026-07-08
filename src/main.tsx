import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Intercept window.fetch globally to inject Authorization header if session token exists in localStorage.
// This is critical for environments (like AI Studio preview iframe) where third-party cookies are blocked by default.
try {
  const originalFetch = window.fetch;
  const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = localStorage.getItem('trackbook_session');
    let headers: HeadersInit = {};

    if (init && init.headers) {
      if (init.headers instanceof Headers) {
        headers = new Headers(init.headers);
      } else if (Array.isArray(init.headers)) {
        headers = [...init.headers];
      } else {
        headers = { ...init.headers as Record<string, string> };
      }
    }

    if (token) {
      if (headers instanceof Headers) {
        headers.set('Authorization', `Bearer ${token}`);
      } else if (Array.isArray(headers)) {
        const authHeaderExists = (headers as string[][]).some(([key]) => key.toLowerCase() === 'authorization');
        if (!authHeaderExists) {
          (headers as string[][]).push(['Authorization', `Bearer ${token}`]);
        }
      } else {
        const hRecord = headers as Record<string, string>;
        if (!hRecord['Authorization'] && !hRecord['authorization']) {
          hRecord['Authorization'] = `Bearer ${token}`;
        }
      }
    }

    return originalFetch(input, {
      ...init,
      headers,
      credentials: 'include'
    });
  };

  Object.defineProperty(window, 'fetch', {
    value: customFetch,
    configurable: true,
    writable: true
  });
} catch (err) {
  console.error('[AUTH FETCH INTERCEPTOR] Failed to define window.fetch property:', err);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
