import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppStateProvider } from './state/AppStateContext';
import { App } from './ui/App';
import './style.css';

const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <StrictMode>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </StrictMode>,
  );
