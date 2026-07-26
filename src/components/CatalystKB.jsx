import React, { useState, useEffect, useRef } from 'react';

export default function CatalystKB() {
  const isAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
  // Tabs: 'chat' or 'settings'
  const [activeTab, setActiveTab] = useState('chat');
  const [documents, setDocuments] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Settings Form State
  const [settings, setSettings] = useState({
    project_id: '',
    org_id: '',
    access_token: '',
    client_id: '',
    client_secret: '',
    refresh_token: '',
    accounts_url: '',
    api_base_url: '',
    auth_code: ''
  });
  const [saveStatus, setSaveStatus] = useState('');

  // Chat State
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am connected to your Zoho Catalyst Knowledge Base. Select the documents you want me to search on the left, and ask me anything about them!'
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);

  // File Upload State
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Filter States
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');



  // Resizable Split Pane State
  const [leftWidth, setLeftWidth] = useState(380); // Default width in pixels
  const isResizing = useRef(false);

  const handleMouseMove = (e) => {
    if (!isResizing.current) return;
    const newWidth = Math.max(280, Math.min(700, e.clientX));
    setLeftWidth(newWidth);
  };

  const stopResizing = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  };

  const startResizing = (e) => {
    e.preventDefault();
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  // Clean up global listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResizing);
    };
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchSettings();
  }, []);

  useEffect(() => {
    // Scroll chat to bottom on new messages
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const fetchDocuments = async () => {
    setDocLoading(true);
    try {
      const res = await fetch('/api/catalyst/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        // Pre-select all documents by default
        setSelectedDocIds(data.map(d => d.document_id));
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setDocLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/catalyst/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/catalyst/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus(''), 3000);
        // Clear auth code from screen input upon successful swap
        setSettings(prev => ({ ...prev, auth_code: '' }));
        // Re-fetch configuration settings to show swapped access and refresh tokens
        await fetchSettings();
      } else {
        const text = await res.text();
        alert(`Failed to save settings: ${text}`);
        setSaveStatus('error');
      }
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    }
  };

  const handleDocCheckboxChange = (docId) => {
    if (selectedDocIds.includes(docId)) {
      setSelectedDocIds(selectedDocIds.filter(id => id !== docId));
    } else {
      setSelectedDocIds([...selectedDocIds, docId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedDocIds.length === filteredDocs.length) {
      // Unselect all filtered docs
      const filteredIds = filteredDocs.map(d => d.document_id);
      setSelectedDocIds(selectedDocIds.filter(id => !filteredIds.includes(id)));
    } else {
      // Select all filtered docs
      const newIds = new Set([...selectedDocIds, ...filteredDocs.map(d => d.document_id)]);
      setSelectedDocIds(Array.from(newIds));
    }
  };

  const copyToClipboard = (text, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    const target = e.currentTarget;
    const oldText = target.innerText;
    target.innerText = 'Copied! ✓';
    target.style.color = 'var(--accent-emerald)';
    setTimeout(() => {
      target.innerText = oldText;
      target.style.color = 'var(--text-muted)';
    }, 1500);
  };

  // Drag and Drop Upload logic
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await handleUploadFile(e.target.files[0]);
    }
  };

  const handleUploadFile = async (file) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/catalyst/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const result = await res.json();
        if (result.status === 'success') {
          // Add to local documents
          setDocuments(prev => [result.document, ...prev]);
          // Select it by default
          setSelectedDocIds(prev => [...prev, result.document.document_id]);
        }
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };



  const handleSendQuery = async (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;
    if (selectedDocIds.length === 0) {
      alert('Please select at least one document from the list to search against.');
      return;
    }

    const queryText = userInput;
    setUserInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: queryText }]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/catalyst/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          documents: selectedDocIds
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' || json.response) {
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: json.response || json.answer || '',
            retrieved_nodes: json.retrieved_nodes || []
          }]);
        } else {
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: `⚠️ API Error: ${json.error || 'Failed to query Zoho Catalyst RAG.'}`,
            details: json.details
          }]);
        }
      } else {
        const text = await res.text();
        let errMsg = 'Failed to connect to backend RAG API.';
        try {
          const parsed = JSON.parse(text);
          errMsg = parsed.detail || errMsg;
        } catch (_) { }

        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ Error: ${errMsg}`
        }]);
      }
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Network Error: Could not reach the API backend.`
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.document_id.includes(searchQuery);
    const matchesType = typeFilter === 'all' || doc.file_type === typeFilter;

    const isChecked = selectedDocIds.includes(doc.document_id);
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'selected' && isChecked) ||
      (statusFilter === 'unselected' && !isChecked);

    return matchesSearch && matchesType && matchesStatus;
  });

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div style={{
      display: 'flex',
      gap: 0,
      padding: '1.25rem',
      height: 'calc(100vh - 65px)',
      background: 'var(--bg-dark)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* LEFT PANEL: Documents List & Upload */}
      <div className="glass" style={{
        width: `${leftWidth}px`,
        flexShrink: 0,
        borderRadius: '16px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--text-main)' }}>📚 Zoho Catalyst Knowledge Base</h2>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Select documents to include as context for the RAG queries.</p>
          </div>
          <button
            onClick={fetchDocuments}
            disabled={docLoading}
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              borderRadius: '6px',
              padding: '0.35rem 0.6rem',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            {docLoading ? '🔄' : 'Refresh'}
          </button>
        </div>

        {/* Search & Filter Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            type="text"
            placeholder="🔍 Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '0.5rem 0.75rem',
              color: 'var(--text-main)',
              fontSize: '0.8rem',
              width: '100%',
              outline: 'none'
            }}
          />

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {/* File Type Filter */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  background: 'var(--bg-dark)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '0.35rem 0.5rem',
                  color: 'var(--text-main)',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  width: '100%',
                  outline: 'none'
                }}
              >
                <option value="all">📁 All Formats</option>
                <option value="pdf">📕 PDF</option>
                <option value="txt">📄 TXT</option>
                <option value="docx">📄 DOCX</option>
              </select>
            </div>

            {/* Selection Status Filter */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  background: 'var(--bg-dark)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '0.35rem 0.5rem',
                  color: 'var(--text-main)',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  width: '100%',
                  outline: 'none'
                }}
              >
                <option value="all">🔍 All Status</option>
                <option value="selected">✅ Selected</option>
                <option value="unselected">⬜ Unselected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table List */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', border: '1px solid var(--border-color)', borderRadius: '10px', background: 'var(--table-bg)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead style={{ background: 'var(--table-header-bg)', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '0.6rem 0.75rem', width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={filteredDocs.length > 0 && selectedDocIds.length === filteredDocs.length}
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)' }}>Document Title</th>
                <th style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)', width: '130px' }}>Zoho Doc ID</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan="3" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                    {docLoading ? 'Loading document list...' : 'No documents found.'}
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => {
                  const isChecked = selectedDocIds.includes(doc.document_id);
                  return (
                    <tr
                      key={doc.id}
                      onClick={() => handleDocCheckboxChange(doc.document_id)}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.02)',
                        background: isChecked ? 'rgba(59, 130, 246, 0.03)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = isChecked ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255,255,255,0.01)'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = isChecked ? 'rgba(59, 130, 246, 0.03)' : 'transparent'}
                    >
                      <td style={{ padding: '0.6rem 0.75rem' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleDocCheckboxChange(doc.document_id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: 'var(--text-main)', fontWeight: '500' }}>
                            {doc.file_type === 'pdf' ? '📕' : '📄'} {doc.title}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
                            {formatBytes(doc.file_size)} • {doc.uploaded_at}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <span
                          onClick={(e) => copyToClipboard(doc.document_id, e)}
                          title="Click to Copy"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.72rem',
                            color: 'var(--text-muted)',
                            background: 'rgba(255,255,255,0.03)',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            display: 'inline-block'
                          }}
                        >
                          {doc.document_id}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Drag & drop upload is restricted by external API scope. Please upload files in Zoho console. */}

      </div>

      {/* Resizable Divider */}
      <div
        onMouseDown={startResizing}
        className="resizer-bar"
        style={{
          width: '12px',
          cursor: 'col-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          alignSelf: 'stretch',
          userSelect: 'none',
          position: 'relative'
        }}
      >
        <div
          className="resizer-handle"
          style={{
            width: '2px',
            height: '40px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '2px',
            transition: 'all 0.2s'
          }}
        />
      </div>

      {/* RIGHT PANEL: Chat / Settings Tab */}
      <div className="glass" style={{
        flex: 1,
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}>
        {/* Tab Headers (Only rendered for Admins) */}
        {isAdmin && (
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            background: 'rgba(255,255,255,0.01)',
            padding: '0.5rem 1.25rem 0 1.25rem',
            gap: '1rem'
          }}>
            <button
              onClick={() => setActiveTab('chat')}
              style={{
                padding: '0.75rem 1rem',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'chat' ? '2px solid var(--accent-blue)' : '2px solid transparent',
                color: activeTab === 'chat' ? 'var(--text-main)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '600'
              }}
            >
              💬 Catalyst RAG Chat
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              style={{
                padding: '0.75rem 1rem',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'settings' ? '2px solid var(--accent-blue)' : '2px solid transparent',
                color: activeTab === 'settings' ? 'var(--text-main)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '600'
              }}
            >
              ⚙️ API & OAuth Settings
            </button>
          </div>
        )}

        {/* TAB 1: Chat interface */}
        {(activeTab === 'chat' || !isAdmin) ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Context bar */}
            <div style={{
              background: 'rgba(59, 130, 246, 0.05)',
              borderBottom: '1px solid var(--border-color)',
              padding: '0.6rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                🔗 Active Context: <strong>{selectedDocIds.length}</strong> documents selected
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                LLM: Zoho 30B MoE (QuickML RAG)
              </span>
            </div>

            {/* Messages Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  width: '100%'
                }}>
                  <div style={{
                    maxWidth: '85%',
                    background: msg.role === 'user' ? 'var(--accent-blue)' : 'var(--bg-card)',
                    color: msg.role === 'user' ? '#FFF' : 'var(--text-main)',
                    borderRadius: '12px',
                    padding: '0.85rem 1rem',
                    border: msg.role === 'user' ? 'none' : '1px solid var(--border-color)',
                    fontSize: '0.85rem',
                    lineHeight: '1.45',
                    boxShadow: msg.role === 'user' ? '0 4px 10px rgba(59, 130, 246, 0.2)' : 'none'
                  }}>
                    {/* Plain Text content with formatting */}
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

                    {/* Detailed errors if present */}
                    {msg.details && (
                      <pre style={{
                        marginTop: '0.5rem',
                        padding: '0.5rem',
                        background: 'var(--bg-dark)',
                        color: 'var(--accent-rose)',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        overflowX: 'auto',
                        border: '1px solid rgba(244,63,94,0.2)'
                      }}>
                        {msg.details}
                      </pre>
                    )}

                    {/* Collapsible Retrieved Nodes (Citations) */}
                    {msg.retrieved_nodes && msg.retrieved_nodes.length > 0 && (
                      <RetrievedNodesList nodes={msg.retrieved_nodes} />
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '12px',
                    padding: '0.85rem 1.25rem',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)'
                  }} className="pulse">
                    ⚡ Querying Zoho Catalyst 30B MoE model...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendQuery} style={{
              padding: '1rem 1.25rem',
              borderTop: '1px solid var(--border-color)',
              background: 'rgba(0,0,0,0.15)',
              display: 'flex',
              gap: '0.75rem'
            }}>
              <input
                type="text"
                placeholder="Ask about workflow, Zoho CRM documents, rules..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={chatLoading}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '0.65rem 1rem',
                  color: 'var(--text-main)',
                  outline: 'none',
                  fontSize: '0.85rem'
                }}
              />
              <button
                type="submit"
                disabled={chatLoading}
                style={{
                  background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                  border: 'none',
                  color: '#000',
                  fontWeight: '700',
                  fontSize: '0.82rem',
                  padding: '0 1.25rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
                }}
              >
                Send
              </button>
            </form>
          </div>
        ) : isAdmin ? (
          /* TAB 2: Settings Form */
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>💼 Zoho Catalyst Workspace Details</h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Project identifier and organizational context headers.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Catalyst Project ID</label>
                    <input
                      type="text"
                      value={settings.project_id}
                      onChange={(e) => setSettings({ ...settings, project_id: e.target.value })}
                      required
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>CATALYST-ORG ID</label>
                    <input
                      type="text"
                      value={settings.org_id}
                      onChange={(e) => setSettings({ ...settings, org_id: e.target.value })}
                      required
                      style={styles.input}
                    />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>🔑 Authentication (Zoho OAuth)</h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Provide a temporary token, or Client Credentials for automated auto-refreshes.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                      Current Access Token (Zoho-oauthtoken)
                    </label>
                    <input
                      type="password"
                      placeholder="Paste temporary access token here..."
                      value={settings.access_token}
                      onChange={(e) => setSettings({ ...settings, access_token: e.target.value })}
                      style={styles.input}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                      Authorization Code
                      {settings.client_id && (
                        <a
                          href={`https://accounts.zoho.in/oauth/v2/auth?scope=QuickML.rag.READ,QuickML.deployment.READ&client_id=${settings.client_id}&response_type=code&redirect_uri=${window.location.port === '5173' ? 'http://localhost:8000/oauth/callback' : window.location.origin + '/oauth/callback'}&access_type=offline&prompt=consent`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ marginLeft: '0.5rem', color: 'var(--accent-blue)', textDecoration: 'underline', fontSize: '0.7rem' }}
                        >
                          🔗 Click here to authorize & get code
                        </a>
                      )}
                    </label>
                    <input
                      type="text"
                      placeholder="Paste authorization code here to swap automatically..."
                      value={settings.auth_code || ''}
                      onChange={(e) => setSettings({ ...settings, auth_code: e.target.value })}
                      style={styles.input}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.25rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Client ID (OAuth2)</label>
                      <input
                        type="text"
                        placeholder="Optional"
                        value={settings.client_id || ''}
                        onChange={(e) => setSettings({ ...settings, client_id: e.target.value })}
                        style={styles.input}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Client Secret (OAuth2)</label>
                      <input
                        type="password"
                        placeholder="Optional"
                        value={settings.client_secret || ''}
                        onChange={(e) => setSettings({ ...settings, client_secret: e.target.value })}
                        style={styles.input}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Refresh Token (OAuth2)</label>
                    <input
                      type="password"
                      placeholder="Optional - Used to refresh access token automatically on expiry"
                      value={settings.refresh_token || ''}
                      onChange={(e) => setSettings({ ...settings, refresh_token: e.target.value })}
                      style={styles.input}
                    />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>🌐 Domain Endpoints</h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Specify base endpoints if using local proxies or different regional domains.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>OAuth Accounts URL</label>
                    <input
                      type="text"
                      value={settings.accounts_url}
                      onChange={(e) => setSettings({ ...settings, accounts_url: e.target.value })}
                      required
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Catalyst API Base URL</label>
                    <input
                      type="text"
                      value={settings.api_base_url}
                      onChange={(e) => setSettings({ ...settings, api_base_url: e.target.value })}
                      required
                      style={styles.input}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                <button
                  type="submit"
                  disabled={saveStatus === 'saving'}
                  style={{
                    background: 'var(--accent-blue)',
                    border: 'none',
                    color: '#000',
                    fontWeight: '600',
                    fontSize: '0.82rem',
                    padding: '0.55rem 1.5rem',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  {saveStatus === 'saving' ? 'Saving...' : 'Save Settings'}
                </button>
                {saveStatus === 'success' && (
                  <span style={{ color: 'var(--accent-emerald)', fontSize: '0.8rem', fontWeight: '500' }}>
                    ✓ Settings saved successfully!
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span style={{ color: 'var(--accent-rose)', fontSize: '0.8rem', fontWeight: '500' }}>
                    ⚠️ Failed to save settings.
                  </span>
                )}
              </div>
            </form>
          </div>
        ) : null}
      </div>

      <style>{`
        .resizer-bar:hover .resizer-handle {
          background: var(--accent-blue) !important;
          width: 4px !important;
          height: 60px !important;
        }
      `}</style>
    </div>
  );
}

// Collapsible Citation Node list helper
function RetrievedNodesList({ nodes }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{
      marginTop: '0.75rem',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      paddingTop: '0.5rem'
    }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          userSelect: 'none'
        }}
      >
        <span>🔍 View {nodes.length} retrieved source chunks</span>
        <span>{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          marginTop: '0.5rem',
          maxHeight: '220px',
          overflowY: 'auto'
        }}>
          {nodes.map((node, nIdx) => {
            // Safely parse page number and score if available
            const score = node.score ?? node.similarity ?? null;
            const scorePct = score ? ` (${Math.round(score * 100)}% match)` : '';
            
            const pageNum = node.metadata?.page_label ?? 
                            node.metadata?.page_number ?? 
                            node.metadata?.page ?? 
                            node.page_no ?? 
                            node.page ?? 
                            null;
                            
            return (
              <div key={nIdx} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
                borderRadius: '6px',
                padding: '0.5rem'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.68rem',
                  color: 'var(--text-dim)',
                  marginBottom: '0.25rem',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  paddingBottom: '0.15rem'
                }}>
                  <span>
                    📄 <strong>{node.document_title || 'Source Document'}</strong>
                    {pageNum && <span style={{ color: 'var(--accent-cyan)', marginLeft: '0.5rem', fontWeight: 600 }}>Page {pageNum}</span>}
                    {scorePct && <span style={{ color: 'var(--accent-lime)', marginLeft: '0.5rem' }}>{scorePct}</span>}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>ID: {node.document_id}</span>
                </div>
                <div style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap'
                }}>
                  {node.content}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  input: {
    width: '100%',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '0.5rem 0.75rem',
    color: 'var(--text-main)',
    fontSize: '0.8rem',
    outline: 'none',
    boxSizing: 'border-box'
  }
};
