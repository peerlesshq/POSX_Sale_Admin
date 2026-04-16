import React from 'react';
import ReactDOM from 'react-dom/client';

// --- Design system ---------------------------------------------------
// Order matters: tokens first (CSS variables), then fonts (family),
// then globals (reset + AntD overrides). After this point no other
// CSS may set body background or default font.
import './theme/tokens.css';
import './theme/fonts.css';
import './theme/globals.css';

// Self-hosted font packages
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';

// ECharts theme registration (side-effect safe; cheap guard inside)
import { registerAdminEchartsTheme } from './theme/echarts-theme';

// Apply the persisted theme before React mounts to avoid a flash of
// wrong background.
import { applyTheme, getStoredTheme } from './theme';

import { App } from './App';

applyTheme(getStoredTheme());
registerAdminEchartsTheme();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
