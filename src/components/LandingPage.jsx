import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, SignInButton, SignUpButton } from '@clerk/react';
import gokLogo from '../assets/Seal_of_Karnataka.png';


export default function LandingPage({ theme, setTheme }) {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();
  const [activeFeedTab, setActiveFeedTab] = React.useState('bulletin');

  React.useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate('/dashboard');
    }
  }, [isLoaded, isSignedIn, navigate]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };


  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: 'var(--bg-dark)',
      color: 'var(--text-main)',
      transition: 'all 0.3s ease',
      overflowX: 'hidden'
    }}>
      {/* Top Government Tricolor Ribbon */}
      <div style={{
        height: '5px',
        background: 'linear-gradient(to right, #FF9933 33%, #FFFFFF 33%, #FFFFFF 66%, #138808 66%)',
        width: '100%'
      }} />

      {/* Official Government Header Banner */}
      <header className="glass" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.85rem 3rem',
        borderBottom: '1px solid var(--border-color)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.03)',
        zIndex: 10,
        background: 'var(--bg-card)'
      }}>
        {/* Left Side: Crest and Portal Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <img
            src={gokLogo}
            alt="Emblem of Karnataka"
            className="notranslate"
            style={{
              height: '56px',
              width: 'auto',
              filter: theme === 'dark' ? 'drop-shadow(0 0 3px rgba(255,255,255,0.25))' : 'none'
            }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          {/* Circular Crest Fallback */}
          <div 
            className="notranslate"
            style={{
              display: 'none',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FF9933, #138808)',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              color: '#FFF',
              fontWeight: 'bold'
            }}
          >
            GOK
          </div>
          <div>
            <h1 style={{
              fontSize: '1.15rem',
              fontWeight: '700',
              letterSpacing: '-0.02em',
              color: 'var(--text-main)',
              margin: 0
            }}>
              ಕರ್ನಾಟಕ ಸರ್ಕಾರ
            </h1>
            <h2 style={{
              fontSize: '1.05rem',
              fontWeight: '500',
              color: 'var(--text-muted)',
              margin: 0
            }}>
              Government of Karnataka
            </h2>
            <p style={{
              fontSize: '0.72rem',
              color: 'var(--text-dim)',
              margin: '1px 0 0 0',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              State Cloud Infrastructure &bull; Unified Database Portal
            </p>
          </div>
        </div>

        {/* Right Side: External Navigation Links & Theme Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <nav style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8rem', fontWeight: '500' }}>
            <a href="https://karnataka.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color = 'var(--accent-blue)'} onMouseOut={(e) => e.target.style.color = 'var(--text-muted)'}> GOK Portal </a>
          </nav>

          <div style={{ width: '1px', height: '18px', background: 'var(--border-color)' }} />


          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="notranslate"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
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
        boxSizing: 'border-box'
      }}>

        {/* Left Column: Portal Showcase, Info & announcements */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
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
              🛡️ Secure NIC-Cloud Federated Database Console
            </span>
            <h2 style={{
              fontSize: '2.6rem',
              fontWeight: '800',
              lineHeight: '1.15',
              color: 'var(--text-main)',
              letterSpacing: '-0.02em',
              marginBottom: '1rem'
            }}>
              Unified Database Management & AI Assistant Portal
            </h2>
            <p style={{
              fontSize: '1.05rem',
              color: 'var(--text-muted)',
              lineHeight: '1.6',
              maxWidth: '650px',
              margin: 0
            }}>
              This dashboard provides authorized administrators, engineers, and department heads with secure, centralized control over the state database clusters. Leverage natural language processing to query structures, map network query topologies, and explore RAG documentation pools.
            </p>
          </div>

          {/* Interactive Statistics Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1rem'
          }}>
            {[
              { label: 'Active DB Clusters', value: '12 Secure Nodes', desc: 'AWS RDS & On-Premise', icon: '🖥️', color: 'var(--accent-cyan)' },
              { label: 'System Latency', value: '11.4 ms Average', desc: 'Sub-millisecond query execution', icon: '⚡', color: 'var(--accent-emerald)' },
              { label: 'Security Protocols', value: 'FIPS 140-2 Level 3', desc: 'NIC cloud-secured network', icon: '🛡️', color: 'var(--accent-rose)' },
              { label: 'Audited Statements', value: '243,184 Processed', desc: 'Real-time analytical graphing', icon: '📊', color: 'var(--accent-purple)' }
            ].map((stat, idx) => (
              <div key={idx} className="glass" style={{
                padding: '1.25rem 1.5rem',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                border: '1px solid var(--border-color)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
                background: 'var(--bg-card)',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
                cursor: 'default'
              }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = stat.color;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'var(--input-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.3rem',
                  border: '1px solid var(--border-color)',
                  flexShrink: 0
                }}>
                  {stat.icon}
                </div>
                <div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {stat.label}
                  </span>
                  <div style={{ fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: '700', marginTop: '2px' }}>
                    {stat.value}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {stat.desc}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Combined IT Bulletins & Live RSS Karnataka News Feed */}
          <div className="glass" style={{
            padding: '1.5rem',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)'
          }}>
            {/* Tab Selectors */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1.25rem',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '0.75rem',
              overflowX: 'auto',
              whiteSpace: 'nowrap'
            }}>
              {[
                { id: 'bulletin', label: '📢 IT Bulletins' },
                { id: 'news_en', label: '📰 Karnataka News (EN)' },
                { id: 'news_kn', label: '📰 ಕರ್ನಾಟಕ ವಾರ್ತೆಗಳು (KN)' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFeedTab(tab.id)}
                  style={{
                    background: activeFeedTab === tab.id ? 'var(--input-bg)' : 'transparent',
                    border: activeFeedTab === tab.id ? '1px solid var(--border-color)' : '1px solid transparent',
                    color: activeFeedTab === tab.id ? 'var(--text-main)' : 'var(--text-muted)',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {activeFeedTab === 'bulletin' && [
                { date: 'JULY 24, 2026', title: 'PostgreSQL RDS Nodes Synced', desc: 'All state departments reporting clean replication logs. Automated index analysis active.', label: 'Normal', color: 'var(--accent-emerald)' },
                { date: 'JULY 22, 2026', title: 'Zoho Catalyst RAG Sync Complete', desc: 'Knowledge Base documents re-indexed. Support queries resolved using updated service manuals.', label: 'Updates', color: 'var(--accent-cyan)' },
                { date: 'JULY 18, 2026', title: 'FIPS 140-2 Audit Completed Successfully', desc: 'State cloud storage complies with National Data Encryption Guidelines. Encryption-at-rest validated.', label: 'Security', color: 'var(--accent-rose)' }
              ].map((bulletin, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  borderBottom: idx === 2 ? 'none' : '1px dashed var(--border-color)',
                  paddingBottom: idx === 2 ? '0' : '0.85rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: '700' }}>{bulletin.date}</span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: '700',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      background: 'var(--input-bg)',
                      border: `1px solid ${bulletin.color}`,
                      color: bulletin.color
                    }}>{bulletin.label}</span>
                  </div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)', margin: 0 }}>{bulletin.title}</h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>{bulletin.desc}</p>
                </div>
              ))}

              {activeFeedTab === 'news_en' && [
                { date: 'JULY 25, 2026', title: 'NIC Cloud Deploys Advanced PostgreSQL Replication', desc: 'NIC Karnataka announces successful migration of federated state database nodes to continuous streaming replication under FIPS guidelines.' },
                { date: 'JULY 24, 2026', title: 'Automated ML Indexing Active for Karnataka Police', desc: 'Bengaluru police command centre completes testing of Zoho QuickML sociological index analysis for predictive crime trend mapping.' },
                { date: 'JULY 22, 2026', title: 'Unified State Cloud Portal Launched by CSG', desc: 'Centre for Smart Governance (CSG) has launched the unified admin console, linking state RAG document pools and query maps.' }
              ].map((news, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  borderBottom: idx === 2 ? 'none' : '1px dashed var(--border-color)',
                  paddingBottom: idx === 2 ? '0' : '0.85rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: '700' }}>{news.date}</span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: '700',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      color: 'var(--accent-blue)'
                    }}>Live Feed</span>
                  </div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)', margin: 0 }}>{news.title}</h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>{news.desc}</p>
                </div>
              ))}

              {activeFeedTab === 'news_kn' && [
                { date: 'JULY 25, 2026', title: 'NIC ಕ್ಲೌಡ್‌ನಿಂದ ಸುಧಾರಿತ ಪೋಸ್ಟ್‌ಗ್ರೆಸ್‌ಕ್ಯೂಎಲ್ ಪ್ರತಿಕೃತಿ ಸಂಯೋಜನೆ', desc: 'NIC ಕರ್ನಾಟಕವು FIPS ಮಾರ್ಗಸೂಚಿಗಳ ಅಡಿಯಲ್ಲಿ ನಿರಂತರ ಸ್ಟ್ರೀಮಿಂಗ್ ಪ್ರತಿಕೃತಿಗಾಗಿ ಫೆಡರೇಟೆಡ್ ರಾಜ್ಯ ಡೇಟಾಬೇಸ್ ನೋಡ್‌ಗಳ ಯಶಸ್ವಿ ವಲಸೆಯನ್ನು ಘೋಷಿಸಿದೆ.' },
                { date: 'JULY 24, 2026', title: 'ಕರ್ನಾಟಕ ಪೊಲೀಸರಿಗಾಗಿ ಸ್ವಯಂಚಾಲಿತ ML ಸೂಚ್ಯಂಕ ಸಕ್ರಿಯ', desc: 'ಬೆಂಗಳೂರು ಪೊಲೀಸ್ ಕಮಾಂಡ್ ಕೇಂದ್ರವು ಮುನ್ಸೂಚಕ ಅಪರಾಧ ಪ್ರವೃತ್ತಿ ಮ್ಯಾಪಿಂಗ್‌ಗಾಗಿ ಜೊಹೊ QuickML ಸಮಾಜಶಾಸ್ತ್ರೀಯ ಸೂಚ್ಯಂಕ ವಿಶ್ಲೇಷಣೆಯ ಪರೀಕ್ಷೆಯನ್ನು ಪೂರ್ಣಗೊಳಿಸಿದೆ.' },
                { date: 'JULY 22, 2026', title: 'CSG ಇಂದ ಏಕೀಕೃತ ರಾಜ್ಯ ಕ್ಲೌಡ್ ಪೋರ್ಟಲ್ ಚಾಲನೆ', desc: 'ಸೆಂಟರ್ ಫಾರ್ ಸ್ಮಾರ್ಟ್ ಗವರ್ನೆನ್ಸ್ (CSG) ಏಕೀಕೃತ ನಿರ್ವಾಹಕ ಕನ್ಸೋಲ್ ಅನ್ನು ಪ್ರಾರಂಭಿಸಿದೆ, ರಾಜ್ಯ RAG ಡಾಕ್ಯುಮೆಂಟ್ ಪೂಲ್‌ಗಳು ಮತ್ತು ಪ್ರಶ್ನೆ ನಕ್ಷೆಗಳನ್ನು ಲಿಂಕ್ ಮಾಡಿದೆ.' }
              ].map((news, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  borderBottom: idx === 2 ? 'none' : '1px dashed var(--border-color)',
                  paddingBottom: idx === 2 ? '0' : '0.85rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: '700' }}>{news.date}</span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: '700',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      color: 'var(--accent-emerald)'
                    }}>ಲೈವ್ ಫೀಡ್</span>
                  </div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)', margin: 0 }}>{news.title}</h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>{news.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Column: High Fidelity Authentication / Console Card */}
        <section style={{ position: 'sticky', top: '100px' }}>
          {isSignedIn ? (
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
          ) : (
            <div className="glass animate-fade-in" style={{
              borderRadius: '24px',
              padding: '3rem 2.25rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              width: '100%',
              maxWidth: '430px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.75rem',
              position: 'relative',
              overflow: 'hidden',
              textAlign: 'center'
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

              {/* Gateway Icon */}
              <div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  color: 'var(--accent-blue)',
                  fontSize: '2.2rem',
                  marginBottom: '1rem',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.1)'
                }}>
                  🛡️
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 0.25rem 0', letterSpacing: '-0.01em' }}>
                  Secure Gateway
                </h3>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: '700',
                  color: 'var(--accent-cyan)',
                  background: 'rgba(6, 182, 212, 0.08)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(6, 182, 212, 0.2)'
                }}>
                  CLERK SECURED
                </span>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                Access to this console is restricted to authorized state department officials. Please sign in or register below.
              </p>

              {/* Clerk Authentication Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                <SignInButton mode="modal">
                  <button
                    style={{
                      background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '0.95rem',
                      fontSize: '0.95rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '0 6px 20px rgba(59, 130, 246, 0.25)',
                      transition: 'all 0.2s ease',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.35)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.25)';
                    }}
                  >
                    🔐 Login/SignIn
                  </button>
                </SignInButton>

                <SignUpButton mode="modal">
                  <button
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '0.85rem',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      width: '100%'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }}
                  >
                    📝 Register Account
                  </button>
                </SignUpButton>
              </div>
            </div>
          )}
        </section>

      </main>

      {/* Official Government Compliant Footer */}
      <footer className="glass" style={{
        marginTop: 'auto',
        borderTop: '1px solid var(--border-color)',
        padding: '1.75rem 4rem',
        background: 'var(--bg-card)',
        textAlign: 'center',
        fontSize: '0.78rem',
        color: 'var(--text-dim)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        zIndex: 5
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', color: 'var(--text-muted)' }}>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy Policy</a> &bull;
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Hyperlinking Policy</a> &bull;
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Security Guidelines</a> &bull;
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Terms of Use</a>
        </div>
        <div>
          Designed, developed and hosted by <strong>Centre for Smart Governance (CSG)</strong>, Government of Karnataka.
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', maxWidth: '800px', margin: '0 auto', lineHeight: '1.4' }}>
          Disclaimer: This is a secure database management console of the Government of Karnataka. Unauthorized attempts to upload, alter, or access system metadata or query logs are strictly prohibited and punishable under the Information Technology Act, 2000.
        </div>
      </footer>
    </div>
  );
}
