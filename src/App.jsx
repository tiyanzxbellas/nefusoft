import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazyWithRetry } from './utils/lazyWithRetry';

import Welcome from './pages/Welcome';

const FloatingLiveChat = lazyWithRetry(() => import('./components/FloatingLiveChat'));
const Home = lazyWithRetry(() => import('./pages/Home'));
const Explore = lazyWithRetry(() => import('./pages/Explore'));
const Ongoing = lazyWithRetry(() => import('./pages/Ongoing'));
const Schedule = lazyWithRetry(() => import('./pages/Schedule'));
const Watch = lazyWithRetry(() => import('./pages/Watch'));
const History = lazyWithRetry(() => import('./pages/History'));
const Favorites = lazyWithRetry(() => import('./pages/Favorites'));
const Manga = lazyWithRetry(() => import('./pages/Manga'));
const Donghua = lazyWithRetry(() => import('./pages/Donghua'));

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
