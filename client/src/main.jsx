import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import '../../shell/css/shell.css';
import '../../shell/css/list-view.css';
import '../../shell/css/playlist-tray.css';
import '../../shared/ui.css';
import '../../shared/controls.css';
import './theme.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
