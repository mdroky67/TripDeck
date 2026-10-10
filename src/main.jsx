import { render } from 'preact';
import App from './app.jsx';
import { consumeRedirectResult } from './google/auth.js';
import './styles.css';

// Must happen before the router writes to location.hash, or the token that
// Google just put there is gone.
consumeRedirectResult();

render(<App />, document.getElementById('app'));

/* PWA — the service worker is what makes it run offline */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
