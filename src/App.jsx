import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import Navbar from './components/Navbar';
import ChatWindow from './components/ChatWindow';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import CatalystKB from './components/CatalystKB';
import LandingPage from './components/LandingPage';
import CrimeMap from './components/CrimeMap';
import DashboardHub from './components/DashboardHub';
import { getApiUrl } from './utils/api';

function AppContent() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [provider, setProvider] = useState('gemini');
  
  // Theme and Clerk Authentication
  let isSignedIn = false;
  let isLoaded = true;
  let signOut = () => {};
  try {
    const auth = useAuth();
    if (auth && typeof auth.isLoaded === 'boolean') {
      isLoaded = auth.isLoaded;
      isSignedIn = !!auth.isSignedIn;
      if (auth.signOut) signOut = auth.signOut;
    }
  } catch (e) {
    isLoaded = true;
    isSignedIn = false;
  }
  const [theme, setTheme] = useState(() => localStorage.getItem('portal_theme') || 'light');

  const isAuthenticated = !!(isLoaded && isSignedIn);

  useEffect(() => {
    // Check FastAPI backend health on load
    const checkHealth = async () => {
      try {
        const res = await fetch(getApiUrl('/api/health'));
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        } else {
          setStatus({ status: 'error', mcp_connected: false });
        }
      } catch (err) {
        setStatus({ status: 'offline', mcp_connected: false });
      }
    };

    checkHealth();
  }, []);

  // Update theme class on body element
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('portal_theme', theme);
  }, [theme]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (e) {
      console.error("Clerk sign out failed:", e);
    }
    navigate('/');
  };

  // Helper component for protected routing
  const ProtectedRoute = ({ children }) => {
    if (!isLoaded) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-main)', color: 'var(--text-main)' }}>
          Loading Security Console...
        </div>
      );
    }
    if (!isAuthenticated) {
      return <Navigate to="/" replace />;
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <Navbar 
          status={status} 
          provider={provider} 
          setProvider={setProvider} 
          theme={theme}
          setTheme={setTheme}
          onLogout={handleLogout}
        />
        {children}
      </div>
    );
  };

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          <LandingPage 
            theme={theme} 
            setTheme={setTheme} 
          />
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <DashboardHub theme={theme} />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/chat" 
        element={
          <ProtectedRoute>
            <ChatWindow provider={provider} />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/insights" 
        element={
          <ProtectedRoute>
            <CrimeMap />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/network" 
        element={
          <ProtectedRoute>
            <AnalyticsDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/catalyst" 
        element={
          <ProtectedRoute>
            <CatalystKB />
          </ProtectedRoute>
        } 
      />
      {/* Fallback redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
