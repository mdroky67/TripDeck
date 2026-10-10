import { render } from 'preact';
import App from './app.jsx';
import './styles.css';

render(<App />, document.getElementById('app'));

/* PWA — the service worker is what makes it run offline */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
