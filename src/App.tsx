// src/App.tsx
//import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { ThemeProvider } from './core/theme/ThemeProvider';
import { SyncProvider } from './modules/core/sync/SyncProvider';
import { MainLayout } from './core/layout/MainLayout';
import { Dashboard } from './routes/Dashboard';
import { ToolsHub } from './routes/ToolsHub';
import { Settings } from './routes/Settings';

import { ProfileProvider } from './modules/core/profiles/ProfileProvider';
import { DriveFabMenu } from './modules/backups/components/DriveFabMenu';

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="evorix-theme">
      <ProfileProvider>
        <SyncProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="tools" element={<ToolsHub />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
            {/* Global Google Drive FAB - Renders into body via Portal */}
            <DriveFabMenu />
          </BrowserRouter>
        </SyncProvider>
      </ProfileProvider>
    </ThemeProvider>
  );
}

export default App;
