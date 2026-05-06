import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

const Welcome = lazy(() => import('./pages/Welcome'));
const Home = lazy(() => import('./pages/Home'));
const Explore = lazy(() => import('./pages/Explore'));
const Ongoing = lazy(() => import('./pages/Ongoing'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Watch = lazy(() => import('./pages/Watch'));
const History = lazy(() => import('./pages/History'));

function App() {
  return (
    <Router>
      <Suspense fallback={<div className="min-h-screen bg-[#0a0a0c]"></div>}>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/home" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/history" element={<History />} />
          <Route path="/ongoing" element={<Ongoing />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/anime/:slug/:episode?" element={<Watch />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;