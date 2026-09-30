import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { applySiteConfig } from './config/site';
import './legacy.css';
import './dual-space.css';
import './continuum.css';

applySiteConfig();
const root = document.getElementById('root');
if (!root) throw new Error('Portfolio root element is missing.');
createRoot(root).render(<App />);

if (import.meta.hot) {
  import.meta.hot.accept('./config/site', (config) => config?.applySiteConfig());
}
