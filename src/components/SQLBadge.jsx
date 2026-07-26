import React, { useState } from 'react';

export default function SQLBadge({ executedQueries }) {
  const [expanded, setExpanded] = useState(false);

  if (!executedQueries || executedQueries.length === 0) return null;

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <button 
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'rgba(59, 130, 246, 0.12)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          color: 'var(--accent-blue)',
          padding: '0.3rem 0.6rem',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: '500',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem'
        }}
      >
        <span>⚡ Executed {executedQueries.length} MCP SQL Tool Call{executedQueries.length > 1 ? 's' : ''}</span>
        <span style={{ fontSize: '0.65rem' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{
          marginTop: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          {executedQueries.map((q, idx) => (
            <div key={idx} style={{
              background: 'var(--bg-dark)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '0.6rem 0.8rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem'
            }}>
              <div style={{ color: 'var(--accent-emerald)', marginBottom: '0.25rem', fontSize: '0.7rem' }}>
                Tool: {q.tool}
              </div>
              <pre style={{ color: 'var(--text-main)', margin: 0, whiteSpace: 'pre-wrap' }}>
                {q.args?.sql || jsonString(q.args)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function jsonString(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return String(obj);
  }
}
