import React, { useState, useRef, useEffect } from 'react';
import DataTable from './DataTable';
import SQLBadge from './SQLBadge';

function parseInlineMarkdown(text) {
  const parts = [];
  const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g;
  const splitText = text.split(regex);

  return splitText.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} style={{ fontWeight: '700', color: 'var(--inline-strong-color)' }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} style={{ background: 'var(--code-bg)', padding: '0.15rem 0.35rem', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.9em', color: 'var(--code-text)' }}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function Markdown({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {lines.map((line, idx) => {
        if (line.startsWith('### ')) {
          return <h4 key={idx} style={{ margin: '0.8rem 0 0.3rem 0', color: 'var(--text-main)', fontSize: '1.15rem', fontWeight: '600' }}>{parseInlineMarkdown(line.slice(4))}</h4>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={idx} style={{ margin: '1rem 0 0.4rem 0', color: 'var(--text-main)', fontSize: '1.3rem', fontWeight: '600', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.2rem' }}>{parseInlineMarkdown(line.slice(3))}</h3>;
        }
        if (line.startsWith('# ')) {
          return <h2 key={idx} style={{ margin: '1.2rem 0 0.6rem 0', color: 'var(--text-main)', fontSize: '1.5rem', fontWeight: '700' }}>{parseInlineMarkdown(line.slice(2))}</h2>;
        }
        if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
          return (
            <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem', lineHeight: '1.6' }}>
              <span>•</span>
              <span>{parseInlineMarkdown(line.trim().slice(2))}</span>
            </div>
          );
        }
        if (!line.trim()) {
          return <div key={idx} style={{ height: '0.4rem' }} />;
        }
        return <p key={idx} style={{ margin: '0', lineHeight: '1.6' }}>{parseInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}

export default function ChatWindow({ provider }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I am your AI Database Assistant connected directly to your AWS RDS PostgreSQL database via MCP (Model Context Protocol). Ask me questions about your database tables, records, or request direct SQL queries!",
      executedQueries: []
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const text = textToSend || input;
    if (!text || !text.trim() || loading) return;

    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          provider: provider
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Extract data table output if available from executed queries
      let dataOutput = null;
      if (data.executed_queries && data.executed_queries.length > 0) {
        const lastResult = data.executed_queries[data.executed_queries.length - 1].result;
        dataOutput = lastResult?.output || null;
      }

      setMessages([...newMessages, {
        role: 'assistant',
        content: data.message || 'No response message',
        executedQueries: data.executed_queries || [],
        dataOutput: dataOutput
      }]);
    } catch (err) {
      console.error(err);
      setMessages([...newMessages, {
        role: 'assistant',
        content: `❌ Error communicating with FastAPI backend: ${err.message}. Make sure backend server is running.`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            executedQueries: m.executedQueries || null,
            dataOutput: m.dataOutput || null
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `chat_history_${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Could not export chat history to PDF: ' + err.message);
    }
  };

  const quickPrompts = [
    "List all database tables",
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public';",
    "How many records are in the database?"
  ];

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 65px)',
      maxWidth: '1100px',
      width: '100%',
      margin: '0 auto',
      padding: '1rem',
      gap: '1rem'
    }}>
      {/* Quick Prompts Bar & Export Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(qp)}
              disabled={loading}
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                padding: '0.35rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-blue)';
                e.currentTarget.style.color = 'var(--text-main)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              💡 {qp}
            </button>
          ))}
        </div>

        <button
          onClick={handleExportPDF}
          disabled={loading || messages.length <= 1}
          style={{
            background: 'linear-gradient(135deg, #10B981, #059669)',
            border: 'none',
            color: '#FFF',
            padding: '0.45rem 1rem',
            borderRadius: '20px',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: messages.length <= 1 ? 'not-allowed' : 'pointer',
            opacity: messages.length <= 1 ? 0.5 : 1,
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
          }}
          onMouseOver={(e) => {
            if (messages.length > 1) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.3)';
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.2)';
          }}
        >
          📄 Export Chat PDF
        </button>
      </div>

      {/* Messages Stream */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        paddingRight: '0.5rem'
      }}>
        {messages.map((msg, index) => (
          <div
            key={index}
            className="animate-fade-in"
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%'
            }}
          >
            {msg.role === 'assistant' && (
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.9rem',
                flexShrink: 0
              }}>
                🤖
              </div>
            )}

            <div style={{
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, #2563EB, #1D4ED8)'
                : 'var(--bg-card)',
              border: msg.role === 'user' ? 'none' : '1px solid var(--border-color)',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              padding: '0.875rem 1.25rem',
              color: 'var(--text-main)',
              fontSize: '1.05rem',
              lineHeight: '1.5',
              boxShadow: msg.role === 'user' ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none'
            }}>
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {msg.role === 'assistant' ? (
                  <Markdown text={msg.content} />
                ) : (
                  msg.content
                )}
              </div>

              {/* Show SQL Badge if any queries were run */}
              {msg.executedQueries && (
                <SQLBadge executedQueries={msg.executedQueries} />
              )}

              {/* Show Data Table if query output exists */}
              {msg.dataOutput && (
                <DataTable dataText={msg.dataOutput} />
              )}
            </div>

            {msg.role === 'user' && (
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--input-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.9rem',
                flexShrink: 0
              }}>
                👤
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: '0.75rem', alignSelf: 'flex-start' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              🤖
            </div>
            <div className="glass" style={{
              padding: '0.75rem 1.25rem',
              borderRadius: '16px 16px 16px 4px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-muted)',
              fontSize: '0.85rem'
            }}>
              <span className="pulse">Querying MCP Postgres Server...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="glass"
        style={{
          display: 'flex',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          borderRadius: '16px',
          alignItems: 'center'
        }}
      >
        <input
          type="text"
          placeholder="Ask a question or enter SQL query..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-main)',
            fontSize: '1.05rem',
            fontFamily: 'var(--font-main)'
          }}
        />

        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            background: input.trim() && !loading
              ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))'
              : 'var(--input-bg)',
            border: 'none',
            color: '#FFF',
            padding: '0.6rem 1.2rem',
            borderRadius: '10px',
            fontWeight: '600',
            fontSize: '0.95rem',
            cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            boxShadow: input.trim() && !loading ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
          }}
        >
          Send ➔
        </button>
      </form>
    </div>
  );
}
