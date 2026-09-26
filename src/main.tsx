import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary.tsx';
import { SettingsProvider } from './context/SettingsContext.tsx';
import { initSystemSelfHealing } from './services/systemSelfHealing.ts';
import './index.css';

// Autonomous bootstrap diagnostic & data protection initialization
initSystemSelfHealing();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </GlobalErrorBoundary>
  </StrictMode>,
);


