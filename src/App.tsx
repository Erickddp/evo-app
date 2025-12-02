// src/App.tsx
//import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { ThemeProvider } from './core/theme/ThemeProvider';
import { MainLayout } from './core/layout/MainLayout';
import { Dashboard } from './routes/Dashboard';
import { ToolsHub } from './routes/ToolsHub';
import { Settings } from './routes/Settings';

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="evorix-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="tools" element={<ToolsHub />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
