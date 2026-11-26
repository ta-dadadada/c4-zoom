import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppStateProvider } from './state/AppStateContext';
import { App } from './ui/App';
import type { Viewer } from './viewer';
import './style.css';

export function mount(viewer: Viewer) {
  const root = document.getElementById('root');
  if (root)
    createRoot(root).render(
      <StrictMode>
        <AppStateProvider viewer={viewer}>
          <App />
        </AppStateProvider>
      </StrictMode>,
    );
}
