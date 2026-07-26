import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Karnataka districts with real GPS coordinates
const DISTRICTS = [
  { name: 'Bengaluru City',              lat: 12.9716, lng: 77.5946 },
  { name: 'Mysuru',                       lat: 12.2958, lng: 76.6394 },
  { name: 'Hubballi-Dharwad',             lat: 15.3647, lng: 75.1240 },
  { name: 'Mangaluru (Dakshina Kannada)', lat: 12.9141, lng: 74.8560 },
  { name: 'Belagavi',                     lat: 15.8497, lng: 74.4977 },
];

const CRIME_FILTERS = ['All', 'Crimes Against Property', 'Crimes Against Person', 'Cyber Crimes', 'Sexual Offences', 'Traffic & Road Safety Crimes'];
const CRIME_COLORS  = { 'Crimes Against Property': '#f97316', 'Crimes Against Person': '#ef4444', 'Cyber Crimes': '#3b82f6', 'Sexual Offences': '#ec4899', 'Traffic & Road Safety Crimes': '#a855f7', 'default': '#94a3b8' };
const RISK_COLORS   = { High: '#ef4444', Medium: '#f97316', Low: '#22c55e' };
const RISK_BG       = { High: 'rgba(239,68,68,0.12)', Medium: 'rgba(249,115,22,0.12)', Low: 'rgba(34,197,94,0.12)' };
const MONTHS_SHORT  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function FlyTo({ district }) {
  const map = useMap();
  useEffect(() => {
    if (district) map.flyTo([district.lat, district.lng], 11, { duration: 1.2 });
  }, [district, map]);
  return null;
}

/* ── Inline SVG Sparkline ── */
function Sparkline({ data, color = '#7ee787', height = 40, width = '100%' }) {
  if (!data || data.length === 0) return null;
  const vals = data.map(d => d.count);
  const max = Math.max(...vals) || 1;
  const min = Math.min(...vals);
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * 100;
    const y = height - ((v - min) / (max - min || 1)) * (height - 6) - 3;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width, height, display: 'block' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,${height} ${pts.join(' ')} 100,${height}`} fill={color} fillOpacity="0.12" stroke="none" />
    </svg>
  );
}

/* ── Inline SVG Bar Chart (hourly) ── */
function HourlyBars({ data }) {
  if (!data || data.length === 0) return null;
  const counts = data.map(d => d.count);
  const max = Math.max(...counts) || 1;
  const barW = 3.5, gap = 0.7, svgW = (barW + gap) * 24, svgH = 44;
  const peakHour = data.reduce((p, c) => c.count > p.count ? c : p, data[0]);
  return (
    <div>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: svgH }}>
        {data.map((d, i) => {
          const barH = Math.max(1, (d.count / max) * (svgH - 6));
          const x = i * (barW + gap);
          const isPeak = d.hour === peakHour.hour;
          return <rect key={i} x={x} y={svgH - barH - 2} width={barW} height={barH}
            fill={isPeak ? '#f97316' : d.hour >= 6 && d.hour <= 18 ? '#58a6ff' : '#7ee787'}
            rx="0.8" opacity={0.85} />;
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#8b949e', marginTop: 2 }}>
        <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
      </div>
      <p style={{ fontSize: 11, color: '#f97316', margin: '4px 0 0', fontWeight: 600 }}>
        Peak: {peakHour.hour}:00 — {peakHour.count} crimes
      </p>
    </div>
  );
}

/* ── District Comparison Card ── */
function CompareCard({ data, onClose }) {
  const { district_a: a, district_b: b } = data;
  if (!a || !b) return null;

  const metrics = [
    { key: 'economic_stress_index',   label: 'Economic Stress',    fmt: v => v.toFixed(2), better: 'low'  },
    { key: 'community_cohesion',      label: 'Community Cohesion', fmt: v => v.toFixed(2), better: 'high' },
    { key: 'police_accessibility',    label: 'Police Access',      fmt: v => v.toFixed(2), better: 'high' },
    { key: 'youth_unemployment_rate', label: 'Youth Unemployment', fmt: v => v + '%',      better: 'low'  },
    { key: 'response_time',           label: 'Response Time',      fmt: v => v + ' min',   better: 'low'  },
    { key: 'median_income',           label: 'Median Income',      fmt: v => '₹' + Number(v).toLocaleString(), better: 'high' },
    { key: 'literacy_rate',           label: 'Literacy Rate',      fmt: v => v + '%',      better: 'high' },
  ];

  const winner = (key, better) => {
    if (better === 'high') return a[key] >= b[key] ? 'a' : 'b';
    return a[key] <= b[key] ? 'a' : 'b';
  };

  return (
    <div style={styles.compareCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ ...styles.sectionHeading, margin: 0 }}>📊 District Comparison</p>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div />
        {[a, b].map(d => (
          <div key={d.name} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e6edf3' }}>{d.name.split(' ')[0]}</div>
            <div style={{ fontSize: 11, padding: '2px 6px', borderRadius: 6, display: 'inline-block', marginTop: 2,
              background: RISK_BG[d.risk_level] || 'rgba(255,255,255,0.05)',
              color: RISK_COLORS[d.risk_level] || '#94a3b8', fontWeight: 600 }}>
              {d.risk_level} · {Number(d.total_cases).toLocaleString()} cases
            </div>
          </div>
        ))}
      </div>

      {/* Metric rows */}
      {metrics.map(({ key, label, fmt, better }) => {
        const w = winner(key, better);
        return (
          <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#8b949e' }}>{label}</span>
            {[['a', a], ['b', b]].map(([side, d]) => (
              <div key={side} style={{
                textAlign: 'center', fontSize: 11, fontWeight: 700, padding: '3px 4px', borderRadius: 5,
                color: w === side ? '#7ee787' : '#c9d1d9',
                background: w === side ? 'rgba(126,231,135,0.1)' : 'rgba(255,255,255,0.03)',
              }}>
                {fmt(d[key] ?? 0)}
              </div>
            ))}
          </div>
        );
      })}

      {/* Top crime categories */}
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[a, b].map(d => (
          <div key={d.name}>
            <p style={{ fontSize: 10, color: '#58a6ff', fontWeight: 600, margin: '0 0 4px' }}>
              {d.name.split(' ')[0]} — Top Crimes
            </p>
            {(d.crimes || []).slice(0, 3).map(c => (
              <div key={c.category} style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: '#8b949e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{c.category}</span>
                <span style={{ color: '#7ee787', fontWeight: 600 }}>{c.count}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CrimeMap() {
  const [districtData, setDistrictData]       = useState({});
  const [selected, setSelected]               = useState(DISTRICTS[0]);
  const [insights, setInsights]               = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [advice, setAdvice]                   = useState('');
  const [adviceLoading, setAdviceLoading]     = useState(false);
  const [simulating, setSimulating]           = useState(false);
  const [simResult, setSimResult]             = useState(null);
  const [activeTab, setActiveTab]             = useState('insights');
  const [viewJson, setViewJson]               = useState(false);
  const [crimeFilter, setCrimeFilter]         = useState('All');
  // Trends
  const [trends, setTrends]                   = useState(null);
  const [trendsLoading, setTrendsLoading]     = useState(false);
  // Compare
  const [compareWith, setCompareWith]         = useState(null);
  const [compareData, setCompareData]         = useState(null);
  const [compareLoading, setCompareLoading]   = useState(false);
  const [showCompare, setShowCompare]         = useState(false);

  const [sliders, setSliders] = useState({
    economic_stress_index:   0.5,
    community_cohesion:      0.5,
    police_accessibility:    0.5,
    youth_unemployment_rate: 15.0,
    patrol_units_nearby:     3.0,
  });

  // ── Fetch district overview on mount ──
  useEffect(() => {
    fetch('/api/map/districts')
      .then(r => r.json())
      .then(d => setDistrictData(d.districts || {}))
      .catch(e => console.error('[CrimeMap] districts fetch failed', e));
  }, []);

  // ── Fetch insights + trends when district changes ──
  useEffect(() => {
    if (!selected) return;
    setInsights(null);
    setAdvice('');
    setSimResult(null);
    setTrends(null);
    setInsightsLoading(true);
    setTrendsLoading(true);
    setCrimeFilter('All');

    fetch(`/api/map/insights?district=${encodeURIComponent(selected.name)}`)
      .then(r => r.json())
      .then(d => {
        setInsights(d);
        setInsightsLoading(false);
        fetchAdvice(selected.name, d.prediction || 'Medium');
        // Seed sliders with real baseline
        if (d.metrics) {
          const m = d.metrics;
          setSliders({
            economic_stress_index:   m.economic_stress_index   ?? 0.5,
            community_cohesion:      m.community_cohesion       ?? 0.5,
            police_accessibility:    m.police_accessibility     ?? 0.5,
            youth_unemployment_rate: m.youth_unemployment_rate  ?? 15.0,
            patrol_units_nearby:     m.patrol_units_nearby      ?? 3.0,
          });
        }
      })
      .catch(() => setInsightsLoading(false));

    fetch(`/api/map/trends?district=${encodeURIComponent(selected.name)}`)
      .then(r => r.json())
      .then(d => { setTrends(d); setTrendsLoading(false); })
      .catch(() => setTrendsLoading(false));
  }, [selected]);

  // ── Gemini advice (async, background) ──
  const fetchAdvice = (distName, riskLevel) => {
    setAdviceLoading(true);
    fetch(`/api/map/advice?district=${encodeURIComponent(distName)}&risk=${encodeURIComponent(riskLevel)}`)
      .then(r => r.json())
      .then(d => { setAdvice(d.explanation || ''); setAdviceLoading(false); })
      .catch(() => {
        setAdvice(`Economic stress and youth unemployment are primary risk factors in ${distName}.`);
        setAdviceLoading(false);
      });
  };

  // ── District Comparison ──
  const handleCompare = useCallback(async (otherName) => {
    if (!selected || !otherName || otherName === selected.name) return;
    setCompareLoading(true);
    setCompareData(null);
    setShowCompare(true);
    try {
      const res = await fetch(`/api/map/compare?a=${encodeURIComponent(selected.name)}&b=${encodeURIComponent(otherName)}`);
      const data = await res.json();
      setCompareData(data);
      setCompareWith(otherName);
    } catch { }
    setCompareLoading(false);
  }, [selected]);

  // ── Simulate ──
  const handleSimulate = async () => {
    setSimulating(true);
    setSimResult(null);
    try {
      const body = {
        district: selected.name,
        economic_stress_index:   sliders.economic_stress_index,
        community_cohesion:      sliders.community_cohesion,
        police_accessibility:    sliders.police_accessibility,
        youth_unemployment_rate: sliders.youth_unemployment_rate,
        patrol_units_nearby:     sliders.patrol_units_nearby,
      };
      const res  = await fetch('/api/map/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      setSimResult(data);
    } catch { setSimResult({ error: 'Simulation failed. Please try again.' }); }
    setSimulating(false);
  };

  const getRisk   = n => districtData[n]?.risk_level || null;
  const getColor  = n => RISK_COLORS[getRisk(n)] || '#64748b';
  const getCases  = n => { const c = districtData[n]?.total_cases; return c !== undefined ? Number(c).toLocaleString() : '…'; };
  const getRadius = n => Math.max(10, Math.min(40, Number(districtData[n]?.total_cases || 100) / 200));

  const filteredCrimes = insights?.crimes?.filter(c =>
    crimeFilter === 'All' || c.category === crimeFilter
  ) || [];

  const insightRisk = insights?.prediction || '—';

  return (
    <div style={styles.page}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <h1 style={styles.title}>🗺️ Karnataka Crime Intelligence Map</h1>
        <p style={styles.subtitle}>Real-time AI risk assessment · Powered by Zoho QuickML + Gemini</p>
        <div style={styles.legend}>
          {Object.entries(RISK_COLORS).map(([k, v]) => (
            <span key={k} style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: v }} /> {k} Risk
            </span>
          ))}
          <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: '#64748b' }} /> No data</span>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div style={styles.layout}>

        {/* ── Map Column ── */}
        <div style={styles.mapCol}>
          <div style={styles.mapWrapper}>
            <MapContainer center={[14.0, 76.1]} zoom={7} style={{ width: '100%', height: '100%', borderRadius: 16 }}>
              <TileLayer
                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FlyTo district={selected} />
              {DISTRICTS.map(d => (
                <CircleMarker key={d.name} center={[d.lat, d.lng]} radius={getRadius(d.name)}
                  pathOptions={{ color: getColor(d.name), fillColor: getColor(d.name),
                    fillOpacity: selected?.name === d.name ? 0.85 : 0.55,
                    weight: selected?.name === d.name ? 3 : 1.5 }}
                  eventHandlers={{ click: () => setSelected(d) }}>
                  <Popup>
                    <div style={styles.popup}>
                      <strong style={{ color: getColor(d.name) }}>{d.name}</strong><br />
                      Risk: <b>{getRisk(d.name) || 'Loading…'}</b><br />
                      Cases: <b>{getCases(d.name)}</b>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          {/* District pills only — compare picker moved to sidebar */}
          <div style={styles.pills}>
            {DISTRICTS.map(d => (
              <button key={d.name} onClick={() => setSelected(d)}
                style={{ ...styles.pill,
                  background: selected?.name === d.name ? getColor(d.name) + '22' : 'rgba(255,255,255,0.04)',
                  borderColor: selected?.name === d.name ? getColor(d.name) : 'rgba(255,255,255,0.1)',
                  color: selected?.name === d.name ? getColor(d.name) : '#8b949e' }}>
                {d.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div style={styles.sidebar}>

          {/* Compare picker + card — inside sidebar so it scrolls */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
            <select
              value={compareWith || ''}
              onChange={e => e.target.value && handleCompare(e.target.value)}
              style={{ flex: 1, ...styles.pill, background: 'rgba(88,166,255,0.1)', borderColor: '#58a6ff44', color: '#58a6ff', cursor: 'pointer', fontSize: 11 }}>
              <option value="">⚖️ Compare with another district…</option>
              {DISTRICTS.filter(d => d.name !== selected?.name).map(d => (
                <option key={d.name} value={d.name}>{d.name}</option>
              ))}
            </select>
            {showCompare && (
              <button onClick={() => { setShowCompare(false); setCompareData(null); setCompareWith(null); }}
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}>
                ✕
              </button>
            )}
          </div>

          {showCompare && (
            compareLoading ? (
              <div style={{ ...styles.card, padding: '16px', textAlign: 'center', color: '#8b949e', fontSize: 12 }}>
                <div style={styles.spinner} /><p style={{ marginTop: 8 }}>Loading comparison…</p>
              </div>
            ) : compareData ? (
              <CompareCard data={compareData} onClose={() => { setShowCompare(false); setCompareData(null); setCompareWith(null); }} />
            ) : null
          )}

          {/* Tab Header */}
          <div style={styles.tabsHeader}>
            {['insights', 'simulator'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                ...styles.tabButton,
                color: activeTab === tab ? '#7ee787' : '#8b949e',
                borderBottom: activeTab === tab ? '2px solid #7ee787' : '2px solid transparent',
              }}>
                {tab === 'insights' ? '🔍 Insights' : '⚡ Simulator'}
              </button>
            ))}
          </div>

          {/* ── INSIGHTS TAB ── */}
          {activeTab === 'insights' && (() => {
            if (insightsLoading) return (
              <div style={styles.card}>
                <div style={styles.cardLoader}><div style={styles.spinner} /><p style={styles.muted}>Loading insights…</p></div>
              </div>
            );
            if (!insights) return null;
            const risk = insightRisk;
            return (
              <>
                {/* Risk badge */}
                <div style={styles.card}>
                  <div style={{ ...styles.badge, background: RISK_BG[risk] || 'rgba(255,255,255,0.05)', borderColor: (RISK_COLORS[risk] || '#94a3b8') + '66' }}>
                    <span style={{ color: RISK_COLORS[risk] || '#94a3b8', fontWeight: 700, fontSize: 16 }}>
                      📍 {selected?.name}
                    </span>
                    <span style={{ color: RISK_COLORS[risk], fontWeight: 600, fontSize: 13 }}>
                      {risk} Risk
                    </span>
                    <span style={styles.muted}>
                      {(districtData[selected?.name]?.total_cases
                        ? Number(districtData[selected?.name].total_cases).toLocaleString()
                        : getCases(selected?.name)
                      )} total cases in database
                    </span>
                  </div>

                  {/* Stats grid */}
                  <div style={styles.statsGrid}>
                    <Stat label="Economic Stress" value={(insights.metrics?.economic_stress_index ?? '—')} color="#ef4444" tooltip="Higher = more stress (0–1)" />
                    <Stat label="Youth Unemployment" value={(insights.metrics?.youth_unemployment_rate?.toFixed(1) ?? '—') + '%'} color="#f97316" tooltip="% of youth unemployed" />
                    <Stat label="Police Access" value={(insights.metrics?.police_accessibility ?? '—')} color="#22c55e" tooltip="Police accessibility index (0–1)" />
                    <Stat label="Community Cohesion" value={(insights.metrics?.community_cohesion ?? '—')} color="#58a6ff" tooltip="Social cohesion index (0–1)" />
                    <Stat label="Patrol Units" value={(insights.metrics?.patrol_units_nearby?.toFixed(1) ?? '—')} color="#a855f7" tooltip="Average patrol units nearby" />
                    <Stat label="Response Time" value={(insights.metrics?.response_time?.toFixed(0) ?? '—') + 'm'} color="#fbbf24" tooltip="Avg police response time (mins)" />
                  </div>
                </div>

                {/* XAI */}
                {insights.contributions?.length > 0 && (
                  <div style={styles.card}>
                    <p style={styles.sectionHeading}>🧠 Explainable AI — Key Risk Drivers</p>
                    <div style={styles.xaiBox}>
                      <p style={styles.xaiSubtitle}>
                        {insights.is_fallback ? 'Local SHAP analysis (Zoho unavailable)' : 'Zoho QuickML feature importance'}
                      </p>
                      {insights.contributions.map(f => (
                        <div key={f.name} style={styles.xaiRow}>
                          <span style={styles.xaiLabel}>{f.name}</span>
                          <div style={styles.xaiBarWrap}>
                            <div style={{ ...styles.xaiBar, width: `${f.value}%`, background: `linear-gradient(90deg,${RISK_COLORS[risk] || '#7ee787'},#58a6ff)` }} />
                          </div>
                          <span style={{ ...styles.xaiPct, color: RISK_COLORS[risk] || '#7ee787' }}>{f.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sociological Assessment */}
                <div style={styles.card}>
                  <div style={styles.adviceBox}>
                    <p style={styles.adviceTitle}>📋 Sociological Assessment</p>
                    {adviceLoading ? (
                      <div style={styles.skeletonLoader}>
                        <div style={styles.skeletonLine} /><div style={styles.skeletonLine2} />
                        <div style={{ ...styles.skeletonLine, width: '90%', marginTop: 8 }} />
                        <div style={{ ...styles.skeletonLine2, marginTop: 4 }} />
                      </div>
                    ) : advice ? (
                      <div>
                        {/* Parse sections: why | how */}
                        {(() => {
                          const parts = advice.split(/\n\n|(?=How to control|Steps to control|To control|Intervention|Recommended action)/i);
                          if (parts.length >= 2) {
                            return (
                              <>
                                <div style={styles.adviceSection}>
                                  <span style={styles.adviceSectionLabel}>⚠️ Why is it risky?</span>
                                  <p style={styles.adviceText}>{parts[0].trim()}</p>
                                </div>
                                <div style={{ ...styles.adviceSection, borderColor: '#22c55e44', background: 'rgba(34,197,94,0.05)' }}>
                                  <span style={{ ...styles.adviceSectionLabel, color: '#22c55e' }}>✅ How to control the risk</span>
                                  <p style={styles.adviceText}>{parts.slice(1).join(' ').trim()}</p>
                                </div>
                              </>
                            );
                          }
                          return <p style={styles.adviceText}>{advice}</p>;
                        })()}
                      </div>
                    ) : (
                      <p style={styles.muted}>Assessment loading…</p>
                    )}
                  </div>
                </div>

                {/* Crime categories with filter */}
                {insights.crimes?.length > 0 && (
                  <div style={styles.card}>
                    <p style={styles.sectionHeading}>📈 Crime Categories</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                      {['All', ...insights.crimes.map(c => c.category)].slice(0, 6).map(cat => (
                        <button key={cat} onClick={() => setCrimeFilter(cat)} style={{
                          ...styles.filterPill,
                          background: crimeFilter === cat ? (CRIME_COLORS[cat] || '#7ee787') + '22' : 'rgba(255,255,255,0.04)',
                          borderColor: crimeFilter === cat ? (CRIME_COLORS[cat] || '#7ee787') : 'rgba(255,255,255,0.08)',
                          color: crimeFilter === cat ? (CRIME_COLORS[cat] || '#7ee787') : '#8b949e',
                        }}>
                          {cat === 'All' ? '🔍 All' : cat.replace('Crimes Against ', '').replace(' Crimes', '')}
                        </button>
                      ))}
                    </div>
                    {filteredCrimes.map(c => (
                      <div key={c.category} style={styles.crimeRow}>
                        <span style={{ ...styles.xaiLabel, color: CRIME_COLORS[c.category] || '#8b949e' }}>{c.category}</span>
                        <span style={{ color: '#7ee787', fontWeight: 600, fontSize: 12 }}>{c.count} cases</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}


          {/* ── SIMULATOR TAB ── */}
          {activeTab === 'simulator' && (
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <h3 style={{ ...styles.cardTitle, margin: 0 }}>⚡ Policy Simulator</h3>
                <button onClick={() => setViewJson(!viewJson)} style={styles.toggleCodeBtn}>
                  {viewJson ? '🎛️ Sliders' : '💻 API JSON'}
                </button>
              </div>
              <p style={{ ...styles.muted, marginBottom: 14 }}>
                Change the conditions below to see how they affect crime risk in <b style={{ color: '#e6edf3' }}>{selected?.name?.split(' ')[0]}</b>.
              </p>

              {!viewJson ? (
                <>
                  {[
                    {
                      key: 'economic_stress_index', icon: '💰', min: 0, max: 1, step: 0.01,
                      label: 'Financial Hardship in the Area',
                      desc: 'How much financial stress do residents face?',
                      low: 'Stable economy', high: 'Severe hardship',
                      badHigh: true,
                    },
                    {
                      key: 'community_cohesion', icon: '🤝', min: 0, max: 1, step: 0.01,
                      label: 'Community Unity & Trust',
                      desc: 'How well do neighbours look out for each other?',
                      low: 'Isolated & divided', high: 'Tight-knit community',
                      badHigh: false,
                    },
                    {
                      key: 'police_accessibility', icon: '🚔', min: 0, max: 1, step: 0.01,
                      label: 'Police Presence & Reachability',
                      desc: 'How easy is it to reach police when needed?',
                      low: 'Very hard to reach', high: 'Highly accessible',
                      badHigh: false,
                    },
                    {
                      key: 'youth_unemployment_rate', icon: '👨‍🎓', min: 0, max: 50, step: 0.5,
                      label: 'Youth Without Jobs (%)',
                      desc: 'Percentage of young people who are unemployed',
                      low: '0% — Full employment', high: '50% — Widespread joblessness',
                      badHigh: true,
                    },
                    {
                      key: 'patrol_units_nearby', icon: '🛡️', min: 0, max: 20, step: 1,
                      label: 'Police Patrol Units Deployed',
                      desc: 'Number of active patrol units in the area',
                      low: 'No patrols', high: '20 active units',
                      badHigh: false,
                    },
                  ].map(({ key, icon, label, desc, min, max, step, low, high, badHigh }) => {
                    const val = sliders[key];
                    const pct = (val - min) / (max - min);
                    const levelIdx = Math.floor(pct * 4.99);
                    const levelLabels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
                    const levelColors = badHigh
                      ? ['#22c55e', '#84cc16', '#fbbf24', '#f97316', '#ef4444']
                      : ['#ef4444', '#f97316', '#fbbf24', '#84cc16', '#22c55e'];
                    const levelEmojis = badHigh
                      ? ['🟢', '🟡', '🟠', '🔴', '🔴']
                      : ['🔴', '🟠', '🟡', '🟢', '🟢'];
                    const lvlColor = levelColors[levelIdx];
                    const lvlLabel = levelLabels[levelIdx];
                    const lvlEmoji = levelEmojis[levelIdx];

                    return (
                      <div key={key} style={styles.simSliderCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>{icon} {label}</div>
                            <div style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>{desc}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: lvlColor }}>{lvlEmoji} {lvlLabel}</div>
                            <div style={{ fontSize: 10, color: '#8b949e' }}>{val}{max <= 1 ? '' : max === 50 ? '%' : ' units'}</div>
                          </div>
                        </div>
                        <input type="range" min={min} max={max} step={step} value={val}
                          onChange={e => setSliders(s => ({ ...s, [key]: parseFloat(e.target.value) }))}
                          style={{ width: '100%', accentColor: lvlColor, height: 4 }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#8b949e', marginTop: 2 }}>
                          <span>{low}</span><span>{high}</span>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div style={{ marginBottom: 12 }}>
                  <p style={styles.developerHeading}>🚀 Payload sent to Zoho QuickML:</p>
                  <pre style={styles.jsonConsole}>
                    {JSON.stringify({ district: selected.name, ...sliders }, null, 2)}
                  </pre>
                </div>
              )}

              <button onClick={handleSimulate} disabled={simulating}
                style={{ ...styles.btn, marginTop: 6, opacity: simulating ? 0.6 : 1 }}>
                {simulating ? '⏳ Running Prediction…' : '🔮 Predict Crime Risk'}
              </button>

              {simResult && !simResult.error && (() => {
                const risk = simResult.prediction;
                const riskMessages = {
                  High:   { emoji: '🔴', headline: 'High Crime Risk Predicted', meaning: 'The current conditions create a high-risk environment. Immediate policy action is recommended.', action: 'Increase patrols, improve police response time, and launch urgent community support programmes.' },
                  Medium: { emoji: '🟡', headline: 'Moderate Crime Risk Predicted', meaning: 'Conditions are mixed. Some factors are increasing risk while others help keep it manageable.', action: 'Focus on improving youth employment and community engagement to push risk down.' },
                  Low:    { emoji: '🟢', headline: 'Low Crime Risk Predicted', meaning: 'Conditions are favourable. The area shows good community strength and police presence.', action: 'Maintain current policing levels and continue community investment to sustain this result.' },
                };
                const msg = riskMessages[risk] || riskMessages['Medium'];

                // Build plain-English XAI narrative
                const xaiNarrative = simResult.zoho_xai?.length > 0
                  ? simResult.zoho_xai.slice(0, 3).map(f => {
                      const descriptions = {
                        'Neighborhood Disorder':          'visible disorder and neglect in the area',
                        'Previous Crime Trend (7-day)':   'recent crime activity in the last week',
                        'Previous Crime Trend (30-day)':  'crime patterns over the last month',
                        'Time of Day & Week Pattern':     'crime-prone times of day/week',
                        'Economic Stress Level':          'financial hardship among residents',
                        'Community Cohesion':             'how united the community is',
                        'Police Accessibility':           'police availability and reach',
                        'Youth Unemployment Rate':        'percentage of unemployed youth',
                        'Patrol Units Nearby':            'number of deployed patrol units',
                      };
                      return descriptions[f.name] || f.name.toLowerCase();
                    })
                  : null;

                return (
                  <div style={{ marginTop: 14 }}>
                    {/* Risk result card */}
                    <div style={{ ...styles.simResultCard, borderColor: (RISK_COLORS[risk] || '#94a3b8') + '55', background: RISK_BG[risk] || 'rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{msg.emoji}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: RISK_COLORS[risk] || '#e6edf3', marginBottom: 4 }}>{msg.headline}</div>
                      <p style={{ ...styles.adviceText, marginBottom: 8 }}>{msg.meaning}</p>
                      <div style={styles.simActionBox}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>✅ Recommended Action</span>
                        <p style={{ ...styles.adviceText, color: '#c9d1d9' }}>{msg.action}</p>
                      </div>
                      <div style={{ fontSize: 10, color: '#8b949e', marginTop: 8 }}>
                        {simResult.is_fallback ? '⚠️ Local model (Zoho unavailable)' : `✓ Zoho QuickML · Confidence: ${((simResult.probability || 0) * 100).toFixed(0)}%`}
                      </div>
                    </div>

                    {/* Plain-English XAI */}
                    {xaiNarrative && (
                      <div style={{ ...styles.simXaiCard }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#58a6ff', margin: '0 0 8px' }}>🧠 Why did the AI predict this?</p>
                        <p style={{ fontSize: 12, color: '#c9d1d9', lineHeight: 1.7, margin: 0 }}>
                          The model's top 3 influencing factors were{' '}
                          <b style={{ color: '#fbbf24' }}>{xaiNarrative[0]}</b>
                          {xaiNarrative[1] ? <>, <b style={{ color: '#fbbf24' }}>{xaiNarrative[1]}</b></> : ''}
                          {xaiNarrative[2] ? <>, and <b style={{ color: '#fbbf24' }}>{xaiNarrative[2]}</b></> : ''}.
                          {risk === 'High' ? ' These conditions significantly elevate the likelihood of criminal activity.' : risk === 'Low' ? ' These conditions help keep crime risk manageable.' : ' Addressing these factors can help reduce risk further.'}
                        </p>
                        {/* Mini visual bars — simplified */}
                        <div style={{ marginTop: 10 }}>
                          {simResult.zoho_xai.slice(0, 4).map(f => (
                            <div key={f.name} style={{ marginBottom: 5 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8b949e', marginBottom: 2 }}>
                                <span>{f.name}</span>
                                <span style={{ color: '#7ee787', fontWeight: 600 }}>{f.value}% influence</span>
                              </div>
                              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                                <div style={{ width: `${f.value}%`, height: '100%', background: `linear-gradient(90deg,${RISK_COLORS[risk] || '#7ee787'},#58a6ff)`, borderRadius: 3 }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              {simResult?.error && <p style={{ color: '#ef4444', marginTop: 8, fontSize: 13 }}>{simResult.error}</p>}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color, tooltip }) {
  return (
    <div style={styles.stat} title={tooltip}>
      <div style={{ fontSize: 14, fontWeight: 700, color: color || '#7ee787' }}>{value ?? '—'}</div>
      <div style={{ fontSize: 10, color: '#8b949e', marginTop: 3, lineHeight: 1.2 }}>{label}</div>
    </div>
  );
}

/* ── Styles ── */
const styles = {
  page:       { minHeight: '100vh', background: 'var(--bg-primary,#0d1117)', color: '#e6edf3', fontFamily: "'Inter',sans-serif", padding: '16px 24px', boxSizing: 'border-box' },
  header:     { marginBottom: 12 },
  title:      { fontSize: 24, fontWeight: 700, margin: 0, background: 'linear-gradient(135deg,#7ee787,#58a6ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  subtitle:   { color: '#8b949e', fontSize: 13, marginTop: 4 },
  legend:     { display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8b949e' },
  legendDot:  { width: 10, height: 10, borderRadius: '50%', display: 'inline-block' },
  layout:     { display: 'grid', gridTemplateColumns: '1fr 390px', gap: 20, alignItems: 'start' },
  mapCol:     { display: 'flex', flexDirection: 'column', gap: 10 },
  mapWrapper: { height: 480, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' },
  pills:      { display: 'flex', flexWrap: 'wrap', gap: 6 },
  pill:       { padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 500, border: '1px solid', transition: 'all 0.2s' },
  filterPill: { padding: '3px 10px', borderRadius: 12, cursor: 'pointer', fontSize: 10, fontWeight: 500, border: '1px solid', transition: 'all 0.15s', whiteSpace: 'nowrap' },
  sidebar:    { display: 'flex', flexDirection: 'column', gap: 10, height: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden', paddingRight: 4, position: 'sticky', top: 16, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' },
  tabsHeader: { display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 5 },
  tabButton:  { flex: 1, padding: '10px 6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.2s', outline: 'none' },
  card:       { background: 'var(--bg-card,#161b22)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 },
  compareCard:{ background: '#161b22', border: '1px solid rgba(88,166,255,0.2)', borderRadius: 14, padding: 14 },
  cardTitle:  { fontSize: 15, fontWeight: 700, marginTop: 0, marginBottom: 10, color: '#e6edf3' },
  badge:      { borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10, border: '1px solid' },
  statsGrid:  { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 4 },
  stat:       { background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '7px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 52 },
  sectionHeading: { fontSize: 12, fontWeight: 600, color: '#58a6ff', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  xaiBox:     { background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 },
  xaiTitle:   { fontSize: 12, fontWeight: 600, color: '#e6edf3', margin: '0 0 4px' },
  xaiSubtitle:{ fontSize: 11, color: '#8b949e', margin: '0 0 10px', lineHeight: 1.3 },
  xaiRow:     { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  xaiLabel:   { fontSize: 11, color: '#8b949e', width: 140, flexShrink: 0 },
  xaiBarWrap: { flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 8, overflow: 'hidden' },
  xaiBar:     { height: '100%', borderRadius: 4, transition: 'width 0.4s ease' },
  xaiPct:     { fontSize: 11, fontWeight: 600, width: 32, textAlign: 'right' },
  crimeRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  adviceBox:  { background: 'rgba(88,166,255,0.07)', border: '1px solid rgba(88,166,255,0.18)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 },
  adviceSection: { background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 8, padding: '8px 10px', marginBottom: 8 },
  adviceSectionLabel: { fontSize: 10, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 5 },
  adviceTitle:{ fontSize: 12, fontWeight: 600, color: '#58a6ff', margin: '0 0 6px' },
  adviceText: { margin: 0, fontSize: 12, lineHeight: 1.7, color: '#c9d1d9' },
  sliderWrap: { marginBottom: 10 },
  sliderLabel:{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8b949e', marginBottom: 3 },
  simSliderCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 },
  simResultCard:  { borderRadius: 12, padding: '14px 16px', border: '1px solid', marginBottom: 10 },
  simActionBox:   { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '8px 10px', marginTop: 6 },
  simXaiCard:     { background: 'rgba(88,166,255,0.07)', border: '1px solid rgba(88,166,255,0.18)', borderRadius: 10, padding: '12px 14px' },
  btn:        { width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#238636,#1f6feb)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 },
  muted:      { fontSize: 12, color: '#8b949e', margin: 0 },
  popup:      { fontSize: 13, lineHeight: 1.7 },
  toggleCodeBtn: { background: 'rgba(88,166,255,0.1)', color: '#58a6ff', border: '1px solid rgba(88,166,255,0.25)', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 },
  developerHeading: { fontSize: 12, fontWeight: 600, color: '#7ee787', margin: '0 0 6px' },
  jsonConsole: { background: '#090d13', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: 12, fontSize: 11, color: '#8b949e', overflowX: 'auto', maxHeight: 200, fontFamily: 'monospace' },
  cardLoader: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 0' },
  spinner: { width: 24, height: 24, border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid #7ee787', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  skeletonLoader: { display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0' },
  skeletonLine: { height: 12, background: 'rgba(255,255,255,0.08)', borderRadius: 4, width: '100%', animation: 'pulse 1.5s infinite ease-in-out' },
  skeletonLine2: { height: 12, background: 'rgba(255,255,255,0.08)', borderRadius: 4, width: '80%', animation: 'pulse 1.5s infinite ease-in-out' },
};

if (typeof document !== 'undefined') {
  const s = document.createElement('style');
  s.innerText = `
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 0.8; } 100% { opacity: 0.4; } }
    select option { background: #161b22; color: #e6edf3; }
  `;
  document.head.appendChild(s);
}
