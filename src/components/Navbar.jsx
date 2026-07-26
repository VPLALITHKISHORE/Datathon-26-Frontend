import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserButton, useAuth } from '@clerk/react';
import gokLogo from '../assets/Seal_of_Karnataka.png';

export default function Navbar({ status, provider, setProvider, theme, setTheme, onLogout }) {
  const { isSignedIn } = useAuth();
  const isHealthy = status?.status === 'healthy' && status?.mcp_connected;
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <header className="glass" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.75rem 1.5rem',
      borderBottom: '1px solid var(--border-color)',
      zIndex: 10,
      background: 'var(--bg-card)',
      transition: 'background-color 0.3s ease, border-color 0.3s ease'
    }}>
      {/* Official Government Branding */}
      <Link 
        to="/" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.85rem', 
          textDecoration: 'none',
          cursor: 'pointer'
        }}
      >
        <img
          src={gokLogo}
          alt="GoK Seal"
          className="notranslate"
          style={{
            height: '42px',
            width: 'auto',
            filter: theme === 'dark' ? 'drop-shadow(0 0 2px rgba(255,255,255,0.2))' : 'none'
          }}
          onError={(e) => {
            e.target.style.display = 'none';
            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
          }}
        />
        <div 
          className="notranslate"
          style={{
            display: 'none',
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #FF9933, #138808)',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.85rem',
            color: '#FFF',
            fontWeight: 'bold'
          }}
        >
          GOK
        </div>
        <div>
          <h1 style={{ fontSize: '0.95rem', fontWeight: '700', letterSpacing: '-0.01em', color: 'var(--text-main)', margin: 0, lineHeight: 1.2 }}>
            ಕರ್ನಾಟಕ ಸರ್ಕಾರ
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, fontWeight: '600' }}>
            State Database Portal
          </p>
        </div>
      </Link>

      {/* Middle Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.35rem',
        background: 'rgba(0, 0, 0, 0.05)',
        padding: '0.25rem',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        overflowX: 'auto'
      }}>
        {[
          { path: '/', label: '🏠 Home' },
          { path: '/dashboard', label: '📊 Dashboard' },
          { path: '/chat', label: '💬 Chat Assistant' },
          { path: '/insights', label: '🗺️ Sociological Insights' },
          { path: '/network', label: '🕸️ Network Topology' },
          { path: '/catalyst', label: '💼 FIR RAG-Chatbot' }
        ].map(tab => {
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              style={{
                background: isActive ? 'var(--bg-card)' : 'transparent',
                border: isActive ? '1px solid var(--border-color)' : '1px solid transparent',
                color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                textDecoration: 'none',
                whiteSpace: 'nowrap'
              }}
              onMouseOver={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-main)';
              }}
              onMouseOut={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Direct Home Navigation Button */}
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'linear-gradient(135deg, #00796b, #0284c7)',
            color: '#ffffff',
            border: 'none',
            padding: '0.45rem 0.85rem',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            boxShadow: '0 2px 6px rgba(0, 121, 107, 0.2)'
          }}
          title="Return to Official Portal Home Page"
        >
          🏠 Home Page
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="notranslate"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          )}
        </button>

        {/* MCP Connection Status */}
        <div 
          className="notranslate"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '20px',
            background: isHealthy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
            border: `1px solid ${isHealthy ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            fontSize: '0.8rem',
            fontWeight: '600',
            color: isHealthy ? 'var(--accent-emerald)' : 'var(--accent-rose)'
          }}
        >
          <span 
            className={`notranslate ${isHealthy ? 'pulse' : ''}`}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isHealthy ? 'var(--accent-emerald)' : 'var(--accent-rose)',
              display: 'inline-block'
            }} 
          />
          {isHealthy ? 'Connected' : 'Connecting...'}
        </div>

        {/* Logout Button */}
        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: 'var(--accent-rose)',
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
            title="Logout and return to main portal"
          >
            🚪 Logout
          </button>
        )}

        {/* Profile Button */}
        <div 
          className="notranslate"
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '0.2rem',
            borderRadius: '50%',
            border: '1px solid var(--border-color)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
          }}
        >
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  );
}
