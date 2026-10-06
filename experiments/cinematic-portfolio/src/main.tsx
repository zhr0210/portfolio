import { createRoot, type Root } from 'react-dom/client';
import App from './App.jsx';
import { applySiteConfig } from './config/site';
import './legacy.css';
import './dual-space.css';
import './continuum.css';
import './cinema.css';

document.body.classList.add('afterimage-preview');
applySiteConfig();
const root = document.getElementById('root');
if (!root) throw new Error('Portfolio root element is missing.');
// Keep one root when this preview entry is re-evaluated by Vite HMR.
const reactRoot: Root = import.meta.hot?.data.reactRoot ?? createRoot(root);
if (import.meta.hot) import.meta.hot.data.reactRoot = reactRoot;
reactRoot.render(<App />);

if (import.meta.hot) {
  import.meta.hot.accept('./config/site', (config) => config?.applySiteConfig());
}
