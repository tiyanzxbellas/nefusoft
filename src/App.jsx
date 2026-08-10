import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import Welcome from './pages/Welcome';

const FloatingLiveChat = lazy(() => import('./components/FloatingLiveChat'));
const Home = lazy(() => import('./pages/Home'));
const Explore = lazy(() => import('./pages/Explore'));
const Ongoing = lazy(() => import('./pages/Ongoing'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Watch = lazy(() => import('./pages/Watch'));
const History = lazy(() => import('./pages/History'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Manga = lazy(() => import('./pages/Manga'));
const Donghua = lazy(() => import('./pages/Donghua'));

function AppContent() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/home" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/manga" element={<Manga />} />
        <Route path="/donghua" element={<Donghua />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/history" element={<History />} />
        <Route path="/ongoing" element={<Ongoing />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/anime/:slug/:episode?" element={<Watch />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      {!isLanding && <FloatingLiveChat />}
    </>
  );
}

function App() {
  return (
    <Router>
      <Suspense fallback={<div className="min-h-screen bg-[#0a0a0c]"></div>}>
        <AppContent />
      </Suspense>
    </Router>
  );
}

export default App;
