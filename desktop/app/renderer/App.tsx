import React, { useState, useEffect } from 'react';
import { MainDashboard } from './pages/MainDashboard.js';
import { FloatingHudView } from './pages/FloatingHudView.js';

export const App: React.FC = () => {
  const [isHudView, setIsHudView] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    if (searchParams.get('view') === 'hud' || hash.includes('hud')) {
      setIsHudView(true);
    }
  }, []);

  if (isHudView) {
    return <FloatingHudView />;
  }

  return <MainDashboard />;
};

