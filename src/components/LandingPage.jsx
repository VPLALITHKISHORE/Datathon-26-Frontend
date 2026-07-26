import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserButton, SignInButton, SignUpButton } from '@clerk/react';

export default function LandingPage({ theme, setTheme }) {
  const navigate = useNavigate();

  let isSignedIn = false;
  let isLoaded = true;
  try {
    const auth = useAuth();
    isSignedIn = !!auth?.isSignedIn;
    isLoaded = auth?.isLoaded !== false;
  } catch (e) {
    console.warn("Clerk auth hook fallback:", e);
  }

  // State
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentLang, setCurrentLang] = useState('EN');
  const [fontSizeOffset, setFontSizeOffset] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'bot', text: 'Namaste! Welcome to Karnataka State Police Portal. How can I assist you today?' }
  ]);
  const [chatInputText, setChatInputText] = useState('');

  // Slides Data
  const slides = [
    {
      img: '/images/slide1_police_hq.jpg',
      title: 'POLICE HEADQUARTERS',
      subtitle: 'Karnataka State Police Central Office, Bengaluru'
    },
    {
      img: '/images/slide2_flagging_off.png',
      title: 'STATEWIDE POLICE SERVICES',
      subtitle: 'Flagging Off Emergency Patrol & Mobile Service Fleet'
    },
    {
      img: '/images/slide3_felicitation.jpg',
      title: 'DEPARTMENTAL FELICITATION',
      subtitle: 'DG & IGP Dr. M.A. Saleem with Hon\'ble Deputy CM Sri D.K. Shivakumar'
    },
    {
      img: '/images/slide4_say_no_to_drugs.jpg',
      title: 'PLEDGE TO SAY NO TO DRUGS',
      subtitle: 'Statewide Youth Awareness Campaign & Anti-Narcotics Drive'
    },
    {
      img: '/images/slide5_stage_event.jpg',
      title: 'POLICE HONORS & AWARDS',
      subtitle: 'Recognizing Exemplary Service in Karnataka State Police'
    }
  ];

  // Auto Slide Switcher
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  // Websites Track Scroll
  const scrollWebsites = (offset) => {
    const track = document.getElementById('websitesTrack');
    if (track) track.scrollBy({ left: offset, behavior: 'smooth' });
  };

  // Font Control
  const adjustFontSize = (delta) => {
    const newOffset = fontSizeOffset + delta;
    setFontSizeOffset(newOffset);
    document.body.style.fontSize = `${14 + newOffset}px`;
  };

  // Chatbot logic
  const handleSendMessage = () => {
    const txt = chatInputText.trim();
    if (!txt) return;

    setChatMessages((prev) => [...prev, { sender: 'user', text: txt }]);
    setChatInputText('');

    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `Thank you for your query regarding "${txt}". For immediate assistance call Emergency 112 or click Gateway Login.`
        }
      ]);
    }, 500);
  };

  return (
    <div style={{ background: '#f1f5f9', color: '#0f172a', minHeight: '100vh', fontFamily: "'Poppins', sans-serif" }}>
      {/* 2. MAIN HEADER & DIGNITARIES */}
      <header style={{
        background: '#ffffff',
        padding: '12px 30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '2px solid #e2e8f0',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)'
      }}>
        {/* Left Dignitary: D.K. Shivakumar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '290px' }}>
          <div style={{ width: '68px', height: '68px', borderRadius: '50%', overflow: 'hidden', border: '2.5px solid #94a3b8', flexShrink: 0, background: '#f1f5f9' }}>
            <img src="/images/dk_shivakumar.png" alt="Shri D.K. Shivakumar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', lineHeight: 1.15 }}>SHRI D.K.SHIVAKUMAR</div>
            <div style={{ width: '60px', height: '3px', background: '#92400e', margin: '5px 0', borderRadius: '2px' }} />
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#475569', fontStyle: 'italic' }}>Hon'ble Deputy Chief Minister | Govt. of Karnataka</div>
          </div>
        </div>

        {/* Center Official Logo and Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
          <img src="/images/karnataka_emblem_color.png" alt="Official Emblem of Karnataka" style={{ width: '72px', height: '72px', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }} />
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', margin: 0 }}>
              {currentLang === 'EN' ? 'Karnataka State Police' : 'ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್'}
            </h1>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#00796b', letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: '3px' }}>
              {currentLang === 'EN' ? 'Government of Karnataka' : 'ಕರ್ನಾಟಕ ಸರ್ಕಾರ'}
            </h2>
          </div>
        </div>

        {/* Right Dignitary: Priyank Kharge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '290px', flexDirection: 'row-reverse', textAlign: 'right' }}>
          <div style={{ width: '68px', height: '68px', borderRadius: '50%', overflow: 'hidden', border: '2.5px solid #94a3b8', flexShrink: 0, background: '#f1f5f9' }}>
            <img src="/images/priyank_kharge.png" alt="Shri Priyank Kharge" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', lineHeight: 1.15 }}>SHRI PRIYANK KHARGE</div>
            <div style={{ width: '60px', height: '3px', background: '#92400e', margin: '5px 0 5px auto', borderRadius: '2px' }} />
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#475569', fontStyle: 'italic' }}>Hon'ble Minister for IT, BT &amp; RDPR | Govt. of Karnataka</div>
          </div>
        </div>
      </header>

      {/* 3. MINIMAL STREAMLINED NAVIGATION BAR */}
      <div style={{ background: '#1e293b', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', maxWidth: '1400px', margin: '0 auto' }}>
          <ul style={{ display: 'flex', alignItems: 'center', gap: '4px', listStyle: 'none', margin: 0, padding: 0 }}>
            <li style={{ padding: '14px 18px', color: '#38bdf8', fontWeight: 600, fontSize: '13.5px', borderBottom: '3px solid #38bdf8', cursor: 'pointer' }}>Home</li>
            <li onClick={() => document.getElementById('featureDesk')?.scrollIntoView({ behavior: 'smooth' })} style={{ padding: '14px 18px', color: '#f1f5f9', fontWeight: 500, fontSize: '13.5px', cursor: 'pointer' }}>Feature Desk</li>
            <li onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })} style={{ padding: '14px 18px', color: '#f1f5f9', fontWeight: 500, fontSize: '13.5px', cursor: 'pointer' }}>Services</li>
            <li onClick={() => document.getElementById('bulletins')?.scrollIntoView({ behavior: 'smooth' })} style={{ padding: '14px 18px', color: '#f1f5f9', fontWeight: 500, fontSize: '13.5px', cursor: 'pointer' }}>Bulletins</li>
            <li onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })} style={{ padding: '14px 18px', color: '#f1f5f9', fontWeight: 500, fontSize: '13.5px', cursor: 'pointer' }}>Contact</li>
          </ul>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isSignedIn ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => navigate('/dashboard')}
                  style={{
                    background: 'linear-gradient(135deg, #00796b, #0284c7)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(0, 121, 107, 0.3)'
                  }}
                >
                  🏛️ Enter Console
                </button>

                <button
                  onClick={() => {
                    try {
                      const auth = useAuth();
                      if (auth?.signOut) auth.signOut();
                    } catch (e) {}
                    window.location.href = '/';
                  }}
                  style={{
                    background: 'rgba(244, 63, 94, 0.15)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    color: '#f43f5e',
                    padding: '7px 14px',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Logout from Account"
                >
                  🚪 Logout
                </button>

                <div 
                  className="notranslate"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.1)',
                    padding: '2px',
                    borderRadius: '50%',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}
                  title="User Profile Account"
                >
                  <UserButton afterSignOutUrl="/" />
                </div>
              </div>
            ) : (
              <SignInButton mode="modal">
                <button
                  style={{
                    background: 'linear-gradient(135deg, #00796b, #0284c7)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  Gateway Sign In
                </button>
              </SignInButton>
            )}
          </div>
        </nav>
      </div>

      {/* 4. HERO SECTION */}
      <section style={{ maxWidth: '1400px', margin: '20px auto', padding: '0 30px', display: 'grid', gridTemplateColumns: '310px 1fr', gap: '20px' }}>
        {/* Left DG & IGP Profile Card */}
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', padding: '24px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
          <div style={{ width: '230px', height: '310px', borderRadius: '8px', overflow: 'hidden', border: '3px solid #cbd5e1', boxShadow: '0 4px 10px rgba(0,0,0,0.12)', marginBottom: '14px', background: '#f1f5f9' }}>
            <img src="/images/dr_saleem.jpg" alt="Dr. M. A. Saleem, IPS - Director General & Inspector General of Police" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Dr. M. A. Saleem, IPS</div>
          <div style={{ fontSize: '12.5px', color: '#475569', fontWeight: 500, lineHeight: 1.45, borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginBottom: '16px', width: '100%' }}>
            Director General &amp; Inspector General of Police<br /><small style={{ color: '#64748b' }}>Karnataka State</small>
          </div>
          <button onClick={() => alert('Direct messaging portal to DG & IGP Office activated.')} style={{ background: '#1d4ed8', color: '#ffffff', border: 'none', padding: '10px 28px', borderRadius: '6px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', width: '85%', boxShadow: '0 3px 6px rgba(29, 78, 216, 0.3)' }}>Contact</button>
        </div>

        {/* Right Hero Slider Container */}
        <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 20px -3px rgba(0,0,0,0.15)', height: '520px', background: '#0f172a' }}>
          {slides.map((s, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: currentSlide === idx ? 1 : 0,
                transition: 'opacity 0.8s ease-in-out',
                backgroundImage: `url('${s.img}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: '30px'
              }}
            >
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15, 23, 42, 0.88) 0%, rgba(15, 23, 42, 0.2) 60%, transparent 100%)' }} />
              <div style={{ position: 'relative', zIndex: 10, color: '#ffffff' }}>
                <div style={{ fontSize: '28px', fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.6)', marginBottom: '6px' }}>{s.title}</div>
                <div style={{ fontSize: '14px', color: '#e2e8f0', maxWidth: '600px' }}>{s.subtitle}</div>
              </div>
            </div>
          ))}

          {/* Controls */}
          <button onClick={prevSlide} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: '16px', zIndex: 20, width: '40px', height: '40px', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer' }}>❮</button>
          <button onClick={nextSlide} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: '16px', zIndex: 20, width: '40px', height: '40px', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer' }}>❯</button>
          <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', gap: '8px' }}>
            {slides.map((_, i) => (
              <div
                key={i}
                onClick={() => setCurrentSlide(i)}
                style={{
                  width: currentSlide === i ? '24px' : '10px',
                  height: '10px',
                  borderRadius: '12px',
                  background: currentSlide === i ? '#ffffff' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 5. REALISTIC LIGHT THEME LANDING SECTION & PERFECT EQUAL HEIGHT SIDEBAR */}
      <section id="featureDesk" style={{ maxWidth: '1400px', margin: '30px auto', padding: '0 30px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'stretch' }}>
        {/* Left Section: Banner, Metrics, Feature Services & IT Bulletins */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Title Banner */}
          <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #00796b 100%)', color: '#ffffff', borderRadius: '14px', padding: '26px 30px', boxShadow: '0 10px 25px -5px rgba(0, 121, 107, 0.25)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.3)', color: '#e0f2fe', padding: '4px 14px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 700, marginBottom: '12px' }}>
              🛡️ SECURE NIC-CLOUD FEDERATED DATABASE CONSOLE
            </div>
            <h2 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '8px', color: '#ffffff' }}>Unified Database Management &amp; AI Assistant Portal</h2>
            <p style={{ fontSize: '13.5px', color: '#e2e8f0', lineHeight: 1.6, margin: 0 }}>
              This dashboard provides authorized administrators, engineers, citizens, and department heads with secure, centralized control over state database clusters, e-services, and real-time analytical reporting.
            </p>
          </div>

          {/* Infrastructure Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', cursor: 'pointer' }} onClick={() => navigate(isSignedIn ? '/dashboard' : '/')}>
              <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🖥️</div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Active DB Clusters</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>12 Secure Nodes</div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>AWS RDS &amp; On-Premise</div>
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', cursor: 'pointer' }} onClick={() => navigate(isSignedIn ? '/dashboard' : '/')}>
              <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>⚡</div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>System Latency</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>11.4 ms Average</div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>Sub-millisecond execution</div>
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', cursor: 'pointer' }} onClick={() => navigate(isSignedIn ? '/dashboard' : '/')}>
              <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🛡️</div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>Security Protocols</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>FIPS 140-2 Level 3</div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>NIC Cloud-secured network</div>
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', cursor: 'pointer' }} onClick={() => navigate(isSignedIn ? '/dashboard' : '/')}>
              <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#faf5ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>📊</div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Audited Statements</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>243,184 Processed</div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>Real-time analytical graphing</div>
              </div>
            </div>
          </div>

          {/* Feature Desk Services Grid */}
          <div id="services" style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ background: 'linear-gradient(135deg, #00796b 0%, #004d40 100%)', color: '#ffffff', padding: '16px 22px', fontWeight: 700, fontSize: '15.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>FEATURE DESK SERVICES</span>
              <span style={{ fontSize: '12px', opacity: 0.9 }}>Single Window Access</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', padding: '20px' }}>
              {[
                { title: 'Recruitment', desc: 'Police constable & officer application desk', icon: '💼', bg: '#eff6ff', color: '#2563eb' },
                { title: 'FIR Search', desc: 'Search & download registered FIR copies', icon: '🔍', bg: '#fff7ed', color: '#ea580c' },
                { title: 'Seva Sindhu', desc: 'Unified G2C state government services', icon: '🌱', bg: '#f0fdf4', color: '#16a34a' },
                { title: 'Citizen Portal', desc: 'Verifications, NOCs & permission requests', icon: '🎯', bg: '#faf5ff', color: '#9333ea' },
                { title: 'KSP e-Lost', desc: 'Report lost mobile phones & documents online', icon: '🛡️', bg: '#fff1f2', color: '#e11d48' },
                { title: 'GeM Tenders', desc: 'e-Procurement & public tender notifications', icon: '🏢', bg: '#f0fdfa', color: '#0d9488' }
              ].map((serv, idx) => (
                <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px 16px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', marginBottom: '12px', borderRadius: '12px', background: serv.bg, color: serv.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{serv.icon}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>{serv.title}</div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>{serv.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Fully Populated IT Bulletins Panel */}
          <div id="bulletins" style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '22px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '2px solid #f1f5f9', paddingBottom: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '6px 14px', borderRadius: '6px' }}>IT Bulletins</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>Karnataka News (EN)</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>ಕರ್ನಾಟಕ ವಾರ್ತೆಗಳು (KN)</div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              {[
                { date: 'JULY 24, 2026 • NORMAL', title: 'PostgreSQL RDS Nodes Synced', desc: 'All state departments reporting clean replication logs. Automated index analysis active.', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
                { date: 'JULY 22, 2026 • UPDATES', title: 'Zoho Catalyst RAG Sync Complete', desc: 'Knowledge Base documents re-indexed. Support queries resolved using updated service manuals.', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
                { date: 'JULY 18, 2026 • SECURITY', title: 'FIPS 140-2 Audit Completed Successfully', desc: 'State cloud storage complies with National Data Encryption Guidelines. Encryption-at-rest validated.', bg: '#fff1f2', color: '#e11d48', border: '#fecdd3' },
                { date: 'JULY 15, 2026 • NETWORK ADVISORY', title: 'State Data Centre (SDC) Fiber Link Upgraded', desc: 'High-speed 10Gbps dedicated fiber backbones active across all district police commissionerates.', bg: '#f0fdfa', color: '#0d9488', border: '#99f6e4' },
                { date: 'JULY 10, 2026 • MAINTENANCE', title: 'e-Lost & FIR Search Database Index Optimization', desc: 'Scheduled database vacuuming and query optimization complete. Response times improved by 40%.', bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
                { date: 'JULY 05, 2026 • SECURITY ALERT', title: 'Multi-Factor Authentication (MFA) Enforced for SSO Portal', desc: 'Mandatory 2FA enabled for all official police logins to prevent unauthorized access.', bg: '#faf5ff', color: '#9333ea', border: '#e9d5ff' }
              ].map((bul, idx) => (
                <div key={idx} style={{ padding: '10px 0', borderBottom: idx === 5 ? 'none' : '1px dashed #e2e8f0' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: 800, background: bul.bg, color: bul.color, border: `1px solid ${bul.border}`, padding: '2px 8px', borderRadius: '4px' }}>{bul.date}</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '4px 0 2px 0' }}>{bul.title}</div>
                  <div style={{ fontSize: '12px', color: '#475569' }}>{bul.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side Flex Column (100% Equal Height to Left Column) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', height: '100%' }}>
          {/* 1. Compact Login Gateway Panel */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0, 121, 107, 0.12)', padding: '24px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #00796b 0%, #0284c7 50%, #7c3aed 100%)' }} />

            <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: '#ffffff', border: '2.5px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', padding: '6px' }}>
              <img src="/images/karnataka_emblem_color.png" alt="Official Emblem of Karnataka" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>

            <h3 style={{ fontSize: '21px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Secure Gateway</h3>
            <span style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: '10px', fontWeight: 800, padding: '2px 10px', borderRadius: '12px', letterSpacing: '0.8px', margin: '5px 0 10px 0', textTransform: 'uppercase' }}>SINGLE SIGN-ON (SSO)</span>

            <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.45, marginBottom: '16px' }}>
              Access to this console is restricted to authorized state department officials, officers, and citizens. Please sign in or register below to proceed to the main dashboard.
            </p>

            {isSignedIn ? (
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #00796b 0%, #0284c7 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '11px 18px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(0, 121, 107, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                🏛️ Enter Admin Dashboard
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                <SignInButton mode="modal">
                  <button
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #00796b 0%, #0284c7 100%)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '11px 18px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(0, 121, 107, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    🔒 Login / SignIn
                  </button>
                </SignInButton>

                <SignUpButton mode="modal">
                  <button
                    style={{
                      width: '100%',
                      background: '#ffffff',
                      border: '1.5px solid #cbd5e1',
                      color: '#0f172a',
                      padding: '10px 18px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    📝 Register Account
                  </button>
                </SignUpButton>
              </div>
            )}
          </div>

          {/* 2. Expanded Big Latest News Box (Fills 100% remaining space) */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '340px' }}>
            <div style={{ background: 'linear-gradient(135deg, #00796b 0%, #0f172a 100%)', color: '#ffffff', padding: '14px 20px', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Latest News</span>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
              {[
                '📜 Legal Bulletin (Fourth Edition)',
                '📜 Legal Bulletin (Third Edition)',
                '📜 Legal Bulletin (Second Edition)',
                '📜 Legal Bulletin (First Edition)',
                '📢 State Police Chief tells personnel to refrain from random vehicle checks.',
                '📱 Towards a Drug-Free Karnataka Empowering Citizens through Android App',
                '🛡️ Hit and Run Motor Accident Compensation Scheme, 2022',
                '📊 Monthly Crime Statistics',
                '📘 "A comprehensive overview and updates on the new legislation."',
                '🎥 Live Webcast of Police Commemoration Day Function, National Police Memorial, New Delhi',
                '⚖️ Mob violence/ Lynching Victim Compensation Scheme 2023.',
                '🌐 Central Equipment Identity Register (CEIR) Portal',
                '🎬 Video guide for block the stolen/lost mobile phones',
                '🚨 e - FIR a Digital Platform for Reporting of Stolen Vehicles.',
                '🎥 Process of Online Police Services - Video Guide',
                '🔒 Information Security Awareness',
                '🤝 National Narcotics Coordination Portal (NCORD)',
                '📢 Circular regarding enforcement of Noise Pollution.',
                '▶️ Police aur Seva YouTube channel collection of short video clips.',
                '💳 Bengaluru Traffic Police have enabled payment of fine amount using Paytm.'
              ].map((newsItem, i) => (
                <div key={i} onClick={() => alert(`Opening ${newsItem}...`)} style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', fontSize: '12.5px', color: '#1e293b', cursor: 'pointer' }}>
                  {newsItem}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. WEBSITES & SERVICES CAROUSEL BAR */}
      <section style={{ maxWidth: '1400px', margin: '40px auto', padding: '0 30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => scrollWebsites(-240)} style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#fff', border: '1px solid #cbd5e1', cursor: 'pointer', flexShrink: 0 }}>❮</button>
          <div id="websitesTrack" style={{ display: 'flex', gap: '16px', overflowX: 'auto', scrollBehavior: 'smooth', padding: '10px 4px', scrollbarWidth: 'none' }}>
            {['e-Governance Websites', 'e-Service Websites', 'Statistics Websites', 'Government Apps', 'Central Govt Websites', 'Technical Websites', 'Kannada Websites'].map((title, i) => (
              <div key={i} style={{ minWidth: '220px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', cursor: 'pointer' }}>
                <div style={{ width: '46px', height: '46px', margin: '0 auto 12px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00796b', fontSize: '20px' }}>🏛️</div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a' }}>{title}</div>
              </div>
            ))}
          </div>
          <button onClick={() => scrollWebsites(240)} style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#fff', border: '1px solid #cbd5e1', cursor: 'pointer', flexShrink: 0 }}>❯</button>
        </div>
      </section>

      {/* 7. COMPREHENSIVE DARK FOOTER */}
      <footer id="contact" style={{ background: '#1e242d', color: '#cbd5e1', fontSize: '13px', borderTop: '4px solid #00796b' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 30px', display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '40px' }}>
          <div>
            <div style={{ background: '#2a323d', color: '#ffffff', padding: '6px 14px', borderRadius: '20px', display: 'inline-block', fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>Disclaimer :</div>
            <p style={{ lineHeight: 1.6, color: '#94a3b8', fontSize: '12.5px' }}>
              This portal provides single-sign-on access to state database management and e-governance services. Content of linked government websites is maintained by respective departments.
            </p>
          </div>

          <div>
            <div style={{ background: '#2a323d', color: '#ffffff', padding: '6px 14px', borderRadius: '20px', display: 'inline-block', fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>Website Policies</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12.5px' }}>
              <a href="#" style={{ color: '#cbd5e1' }}>Privacy Policy</a>
              <a href="#" style={{ color: '#cbd5e1' }}>Hyperlinking Policy</a>
              <a href="#" style={{ color: '#cbd5e1' }}>Security Guidelines</a>
              <a href="#" style={{ color: '#cbd5e1' }}>Terms of Use</a>
            </div>
          </div>

          <div>
            <div style={{ background: '#2a323d', color: '#ffffff', padding: '6px 14px', borderRadius: '20px', display: 'inline-block', fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>Visitors Info</div>
            <div style={{ fontSize: '12.5px' }}>
              <p style={{ marginBottom: '6px' }}>Last Updated : <strong style={{ color: '#fff' }}>26-07-2026 08:15 PM</strong></p>
              <p style={{ marginBottom: '6px' }}>Visitors Counter : <strong style={{ color: '#fff' }}>663,274</strong></p>
              <p>Console Version : <strong style={{ color: '#fff' }}>GOK/KSP v2.4</strong></p>
            </div>
          </div>
        </div>

        <div style={{ background: '#15181e', padding: '12px', textAlign: 'center', borderTop: '1px solid #2a323d', borderBottom: '1px solid #2a323d', fontWeight: 700, fontSize: '12px', color: '#e2e8f0' }}>
          Designed, developed and hosted by Centre for Smart Governance (CSG), Government of Karnataka.
        </div>

        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px 30px', textAlign: 'center', fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.6 }}>
          Disclaimer: This is a secure database management console of the Government of Karnataka. Unauthorized attempts to upload, alter, or access system metadata are strictly prohibited under the Information Technology Act, 2000.
        </div>
      </footer>

      {/* FLOATING CHATBOT WIDGET */}
      <div onClick={() => setChatOpen(!chatOpen)} style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 200, background: 'linear-gradient(135deg, #00796b, #004d40)', color: '#ffffff', padding: '10px 18px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 6px 20px rgba(0, 121, 107, 0.4)', cursor: 'pointer' }}>
        <span style={{ fontSize: '20px' }}>💬</span>
        <span style={{ fontWeight: 600, fontSize: '13.5px' }}>May I Help You!</span>
      </div>

      {chatOpen && (
        <div style={{ position: 'fixed', bottom: '84px', right: '24px', width: '340px', background: '#ffffff', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', zIndex: 210, overflow: 'hidden' }}>
          <div style={{ background: '#00796b', color: '#fff', padding: '12px 16px', fontWeight: 700, fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>KSP Virtual Police Assistant</span>
            <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ padding: '14px', maxHeight: '260px', overflowY: 'auto', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{ padding: '8px 12px', borderRadius: '8px', maxWidth: '85%', background: msg.sender === 'bot' ? '#f1f5f9' : '#00796b', color: msg.sender === 'bot' ? '#1e293b' : '#ffffff', alignSelf: msg.sender === 'bot' ? 'flex-start' : 'flex-end' }}>
                {msg.text}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', padding: '8px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <input
              type="text"
              value={chatInputText}
              onChange={(e) => setChatInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type your query here..."
              style={{ flex: 1, border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
            />
            <button onClick={handleSendMessage} style={{ background: '#00796b', color: '#fff', border: 'none', padding: '0 12px', marginLeft: '6px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
