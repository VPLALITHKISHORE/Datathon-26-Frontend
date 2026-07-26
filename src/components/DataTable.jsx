import React, { useState } from 'react';

export default function DataTable({ dataText }) {
  const [filter, setFilter] = useState('');

  if (!dataText || typeof dataText !== 'string') return null;

  // Try parsing raw string into JSON table format if applicable
  let rows = [];
  let headers = [];

  try {
    const parsed = JSON.parse(dataText);
    if (Array.isArray(parsed) && parsed.length > 0) {
      headers = Object.keys(parsed[0]);
      rows = parsed;
    }
  } catch (e) {
    // If not standard JSON array, render clean preformatted output block
    return (
      <div style={{
        marginTop: '0.75rem',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        background: 'var(--table-input-bg)',
        border: '1px solid var(--border-color)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.8rem',
        overflowX: 'auto',
        color: 'var(--text-main)',
        whiteSpace: 'pre-wrap'
      }}>
        {dataText}
      </div>
    );
  }

  if (headers.length === 0) return null;

  const filteredRows = rows.filter(row => 
    Object.values(row).some(val => 
      String(val).toLowerCase().includes(filter.toLowerCase())
    )
  );

  return (
    <div style={{
      marginTop: '1rem',
      borderRadius: '10px',
      overflow: 'hidden',
      border: '1px solid var(--border-color)',
      background: 'var(--table-bg)'
    }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.6rem 1rem',
        background: 'var(--table-header-bg)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--accent-cyan)' }}>
          📊 Query Results ({filteredRows.length} rows)
        </span>
        <input 
          type="text" 
          placeholder="Filter results..." 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            background: 'var(--table-input-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-main)',
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            outline: 'none'
          }}
        />
      </div>

      {/* Table Container */}
      <div style={{ overflowX: 'auto', maxHeight: '280px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: 'var(--table-header-bg)', color: 'var(--text-muted)' }}>
              {headers.map(h => (
                <th key={h} style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)', fontWeight: '600' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, idx) => (
              <tr key={idx} style={{
                borderBottom: '1px solid var(--border-color)',
                background: idx % 2 === 0 ? 'transparent' : 'var(--table-row-stripe)'
              }}>
                {headers.map(h => (
                  <td key={h} style={{ padding: '0.45rem 0.75rem', color: 'var(--text-main)' }}>
                    {String(row[h] ?? 'NULL')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
