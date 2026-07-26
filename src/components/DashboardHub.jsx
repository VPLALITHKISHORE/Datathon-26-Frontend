import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../utils/api';

export default function DashboardHub({ theme }) {
  const navigate = useNavigate();
  const [activeFeedTab, setActiveFeedTab] = useState('en');
  const [newsData, setNewsData] = useState({ en: [], kn: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setIsLoading(true);
        const url = getApiUrl('/api/karnataka-news');
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch RSS news feed');
        }
        const data = await response.json();
        setNewsData(data);
      } catch (err) {
        console.error(err);
        setError('Unable to load live RSS feed. Please verify the backend service is running.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNews();
  }, []);

  const getProxiedImageUrl = (url) => {
    if (!url) return '';
    const encodedUrl = encodeURIComponent(url);
    return getApiUrl(`/api/proxy-image?url=${encodedUrl}`);
  };

  const getCategory = (title) => {
    const t = title.toLowerCase();
    if (t.includes('rain') || t.includes('weather') || t.includes('monsoon') || t.includes('flood') || t.includes('ಮಳೆ') || t.includes('ಹವಾಮಾನ')) {
      return 'WEATHER';
    }
    if (t.includes('cabinet') || t.includes('shivakumar') || t.includes('bjp') || t.includes('congress') || t.includes('politics') || t.includes('ಸಚಿವ') || t.includes('ಚುನಾವಣೆ')) {
      return 'POLITICS';
    }
    if (t.includes('water') || t.includes('cauvery') || t.includes('dam') || t.includes('ಕಾವೇರಿ') || t.includes('ನದಿ')) {
      return 'RESOURCES';
    }
    if (t.includes('rail') || t.includes('train') || t.includes('road') || t.includes('airport') || t.includes('ರೈಲು') || t.includes('ರಸ್ತೆ')) {
      return 'INFRASTRUCTURE';
    }
    if (t.includes('school') || t.includes('student') || t.includes('college') || t.includes('ಶಿಕ್ಷಣ') || t.includes('ಶಾಲೆ')) {
      return 'EDUCATION';
    }
    return 'LATEST';
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'WEATHER': return '🌧️';
      case 'POLITICS': return '🏛️';
      case 'RESOURCES': return '💧';
      case 'INFRASTRUCTURE': return '🛤️';
      case 'EDUCATION': return '🎓';
      default: return '📰';
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'WEATHER': return 'linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(59, 130, 246, 0.08))';
      case 'POLITICS': return 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(239, 68, 68, 0.08))';
      case 'RESOURCES': return 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 182, 212, 0.08))';
      case 'INFRASTRUCTURE': return 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(236, 72, 153, 0.08))';
      case 'EDUCATION': return 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(139, 92, 246, 0.08))';
      default: return 'linear-gradient(135deg, rgba(107, 114, 128, 0.08), rgba(156, 163, 175, 0.08))';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).toUpperCase();
    } catch {
      return dateStr;
    }
  };

  return (
    <main style={{
      flex: 1,
      display: 'grid',
      gridTemplateColumns: '1.2fr 0.8fr',
      padding: '2rem 3rem',
      gap: '2.5rem',
      maxWidth: '100%',
      width: '100%',
      margin: '0 auto',
      alignItems: 'start',
      overflowY: 'auto',
      height: 'calc(100vh - 70px)',
      boxSizing: 'border-box'
    }}>
      {/* Left Column: Live RSS Karnataka News Portal */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
        <div>
          <span style={{
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            color: 'var(--accent-blue)',
            padding: '0.35rem 0.85rem',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            display: 'inline-block',
            marginBottom: '1.25rem'
          }}>
            📡 LIVE STATE BULLETIN SERVICE
          </span>
          <h2 style={{
            fontSize: '2.4rem',
            fontWeight: '800',
            lineHeight: '1.15',
            color: 'var(--text-main)',
            letterSpacing: '-0.02em',
            marginBottom: '0.75rem'
          }}>
            Karnataka State Live News Feed
          </h2>
          <p style={{
            fontSize: '1rem',
            color: 'var(--text-muted)',
            lineHeight: '1.5',
            maxWidth: '650px',
            margin: 0
          }}>
            Live updates and official announcements parsed directly in real-time from official state RSS feeds.
          </p>
        </div>

        {/* Dynamic RSS News Feed Panel */}
        <div className="glass" style={{
          padding: '1.75rem',
          borderRadius: '20px',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          {/* Tab Selectors */}
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '0.75rem'
          }}>
            {[
              { id: 'en', label: '📰 English News Feed' },
              { id: 'kn', label: '📰 ಕರ್ನಾಟಕ ವಾರ್ತೆಗಳು (Kannada)' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFeedTab(tab.id)}
                style={{
                  background: activeFeedTab === tab.id ? 'var(--input-bg)' : 'transparent',
                  border: activeFeedTab === tab.id ? '1px solid var(--border-color)' : '1px solid transparent',
                  color: activeFeedTab === tab.id ? 'var(--text-main)' : 'var(--text-muted)',
                  padding: '0.5rem 1.25rem',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Loader / Error / Feed Output */}
          {isLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{
                margin: '0 auto 1rem auto',
                width: '32px',
                height: '32px',
                border: '3px solid var(--border-color)',
                borderTopColor: 'var(--accent-blue)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span>Fetching live RSS feeds...</span>
            </div>
          ) : error ? (
            <div style={{
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              background: 'rgba(239, 68, 68, 0.05)',
              color: 'var(--accent-rose)',
              fontSize: '0.88rem',
              textAlign: 'center'
            }}>
              ⚠️ {error}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {(newsData[activeFeedTab] || []).length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                  No recent articles found in this feed.
                </div>
              ) : (
                (newsData[activeFeedTab] || []).map((news, idx, arr) => (
                  <div key={idx} style={{
                    display: 'flex',
                    gap: '1.25rem',
                    alignItems: 'start',
                    borderBottom: idx === arr.length - 1 ? 'none' : '1px dashed var(--border-color)',
                    paddingBottom: idx === arr.length - 1 ? '0' : '1.25rem'
                  }}>
                    {/* Visual Block: Thumbnail Image or Fallback category styled card */}
                    {news.imageUrl ? (
                      <img 
                        src={getProxiedImageUrl(news.imageUrl)} 
                        alt={news.title}
                        referrerPolicy="no-referrer"
                        style={{
                          width: '120px',
                          height: '80px',
                          borderRadius: '12px',
                          objectFit: 'cover',
                          border: '1px solid var(--border-color)',
                          flexShrink: 0
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '120px',
                        height: '80px',
                        borderRadius: '12px',
                        background: getCategoryColor(getCategory(news.title)),
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.75rem',
                        flexShrink: 0
                      }}>
                        {getCategoryIcon(getCategory(news.title))}
                      </div>
                    )}

                    {/* Metadata, Title & Description */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: '800',
                          letterSpacing: '0.05em',
                          color: activeFeedTab === 'en' ? 'var(--accent-blue)' : 'var(--accent-emerald)',
                          background: activeFeedTab === 'en' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px'
                        }}>{getCategory(news.title)}</span>
                        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                          <span>{news.source}</span>
                          <span>&bull;</span>
                          <span>{formatDate(news.pubDate)}</span>
                        </div>
                      </div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)', margin: '0.15rem 0', lineHeight: '1.3' }}>
                        <a 
                          href={news.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }}
                          onMouseOver={(e) => e.target.style.color = 'var(--accent-blue)'}
                          onMouseOut={(e) => e.target.style.color = 'inherit'}
                        >
                          {news.title}
                        </a>
                      </h4>
                      {news.description && (
                        <p 
                          style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}
                          dangerouslySetInnerHTML={{ __html: news.description.substring(0, 140) + (news.description.length > 140 ? '...' : '') }}
                        />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* Right Column: High Fidelity Command Hub Card */}
      <section style={{ position: 'sticky', top: '100px' }}>
        <div className="glass animate-fade-in" style={{
          borderRadius: '24px',
          padding: '2.5rem 2rem',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12)',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-card)',
          width: '100%',
          maxWidth: '430px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Top Saffron/Green Ribbon */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(to right, #FF9933, #138808)'
          }} />

          {/* Hub Header */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.2)',
              color: 'var(--accent-cyan)',
              fontSize: '1.8rem',
              marginBottom: '0.75rem'
            }}>
              🏛️
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 0.25rem 0', letterSpacing: '-0.01em' }}>
              State Command Hub
            </h3>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: '700',
              color: 'var(--accent-emerald)',
              background: 'rgba(16, 185, 129, 0.08)',
              padding: '0.2rem 0.6rem',
              borderRadius: '10px',
              border: '1px solid rgba(16, 185, 129, 0.2)'
            }}>
              SECURE CONSOLE ACTIVE
            </span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0, textAlign: 'center' }}>
            Welcome, administrator. Select a command module below to launch the respective state cloud systems.
          </p>

          {/* Quick Access Menu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'linear-gradient(135deg, #00796b, #0284c7)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '1rem',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                boxShadow: '0 4px 12px rgba(0, 121, 107, 0.25)'
              }}
            >
              <strong style={{ fontSize: '0.92rem', fontWeight: '700' }}>🏠 Return to Home Page</strong>
              <span style={{ fontSize: '0.75rem', opacity: 0.9, lineHeight: '1.3' }}>Go back to official Karnataka State Police web portal.</span>
            </button>

            {[
              { path: '/chat', label: '💬 AI Chat Assistant', desc: 'Query database schemas & run SQL using natural language.' },
              { path: '/insights', label: '🗺️ Sociological Insights Map', desc: 'Explore vector GIS maps & run Zoho QuickML simulators.' },
              { path: '/network', label: '🕸️ Network & Query Topologies', desc: 'Visualize node connections, load status & latency.' },
              { path: '/catalyst', label: '💼 FIR RAG Document Pool', desc: 'Analyze First Information Reports via semantic chatbot.' }
            ].map((link, idx) => (
              <button
                key={idx}
                onClick={() => navigate(link.path)}
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  borderRadius: '12px',
                  padding: '1rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-blue)';
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.04)';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.background = 'var(--input-bg)';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                <strong style={{ fontSize: '0.88rem', fontWeight: '700' }}>{link.label}</strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: '1.3' }}>{link.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
