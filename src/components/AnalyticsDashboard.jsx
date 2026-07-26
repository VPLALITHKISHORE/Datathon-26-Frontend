import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '../utils/api';

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [graphNodes, setGraphNodes] = useState([]);
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl('/api/analytics'));
      if (!res.ok) {
        throw new Error(`Failed to fetch analytics: ${res.statusText}`);
      }
      const json = await res.json();
      if (json.success) {
        setData(json);
        initializeLayout(json.network.nodes, json.network.edges);
      } else {
        throw new Error(json.error || 'Unknown error');
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const initializeLayout = (initialNodes, edges) => {
    const width = 760;
    const height = 480;
    
    // Categorize nodes and assign columns
    // Left: Cases (x = 180)
    // Center: Repeat Offenders (x = 380)
    // Right: Single-time Offenders (x = 580)
    let nodes = initialNodes.map((n, i) => {
      let targetX = width / 2;
      if (n.type === 'case') {
        targetX = 180;
      } else {
        const isRepeat = n.val > 20; // Repeat offenders have larger size (val > 20)
        targetX = isRepeat ? 380 : 580;
      }
      
      const angle = (i / initialNodes.length) * 2 * Math.PI;
      return {
        ...n,
        targetX,
        x: targetX + Math.cos(angle) * 30,
        y: height / 6 + (Math.random() * (height * 2/3)),
      };
    });

    // Run simple force-directed layout simulation for 180 iterations
    for (let step = 0; step < 180; step++) {
      // 1. Repulsion between all nodes (increased distance for better spacing)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          let minDist = 90;
          if (nodes[i].type === 'case' && nodes[j].type === 'case') {
            minDist = 140; // Space cases out vertically
          } else if (nodes[i].type === 'suspect' && nodes[j].type === 'suspect') {
            const isIRepeat = nodes[i].val > 20;
            const isJRepeat = nodes[j].val > 20;
            minDist = (isIRepeat || isJRepeat) ? 140 : 100;
          } else {
            minDist = 110; // Case-Suspect spacing
          }
          
          if (dist < minDist) {
            const force = (minDist - dist) / dist * 0.45;
            nodes[i].x -= dx * force;
            nodes[i].y -= dy * force;
            nodes[j].x += dx * force;
            nodes[j].y += dy * force;
          }
        }
      }

      // 2. Attraction along edges
      for (const edge of edges) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const desiredDist = edge.type === 'accomplice' ? 80 : 120;
          if (dist > desiredDist) {
            const force = (dist - desiredDist) / dist * 0.05;
            sourceNode.x += dx * force;
            sourceNode.y += dy * force;
            targetNode.x -= dx * force;
            targetNode.y -= dy * force;
          }
        }
      }

      // 3. Gravity towards column targets and bounding
      for (const node of nodes) {
        node.x += (node.targetX - node.x) * 0.12;
        node.y += (height / 2 - node.y) * 0.02;
        node.x = Math.max(50, Math.min(width - 50, node.x));
        node.y = Math.max(40, Math.min(height - 40, node.y));
      }
    }

    setGraphNodes(nodes);
  };

  // Node Dragging & Canvas Panning Handlers
  const handleMouseDown = (e, nodeId) => {
    e.preventDefault();
    setDraggedNodeId(nodeId);
  };

  const handleSvgMouseDown = (e) => {
    // Only pan if we clicked the background or the bg-rect
    if (e.target.tagName === 'svg' || e.target.id === 'bg-rect') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    
    if (draggedNodeId) {
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = 760 / rect.width;
      const scaleY = 480 / rect.height;
      
      // Calculate coordinates relative to current zoom and pan offset
      const x = ((e.clientX - rect.left) * scaleX - pan.x) / zoom;
      const y = ((e.clientY - rect.top) * scaleY - pan.y) / zoom;
      
      setGraphNodes(nodes => nodes.map(n => {
        if (n.id === draggedNodeId) {
          return {
            ...n,
            x: Math.max(30, Math.min(730, x)),
            y: Math.max(30, Math.min(450, y))
          };
        }
        return n;
      }));
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setDraggedNodeId(null);
    setIsPanning(false);
  };

  const zoomIn = () => setZoom(z => Math.min(3.0, z * 1.25));
  const zoomOut = () => setZoom(z => Math.max(0.4, z * 0.8));
  const resetZoom = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 65px)', color: 'var(--text-muted)' }}>
        <div className="pulse" style={{ fontSize: '1.2rem', fontWeight: '500' }}>⚡ Processing Database Criminal Network Graph...</div>
        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', opacity: 0.7 }}>Analyzing accused links, cliques, and crime trends...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 65px)', padding: '2rem' }}>
        <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '1.5rem', borderRadius: '12px', maxWidth: '500px', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--accent-rose)', marginBottom: '0.5rem' }}>⚠️ Analytics Engine Error</h3>
          <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '1rem' }}>{error}</p>
          <button 
            onClick={fetchData} 
            style={{ background: 'var(--accent-blue)', color: '#FFF', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const { stats, cliques, suspects, cases, network, trends, hotspots } = data;

  // Connection highlighting filter logic
  const isFiltered = selectedNode !== null || searchQuery.trim() !== '';
  const connectedNodeIds = new Set();
  const connectedEdgeIds = new Set();
  const matchedNodeIds = new Set();

  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase().trim();
    // 1. Find directly matched nodes
    graphNodes.forEach(node => {
      const matchLabel = node.label.toLowerCase().includes(q);
      const matchDetails = node.details.toLowerCase().includes(q);
      if (matchLabel || matchDetails) {
        matchedNodeIds.add(node.id);
        connectedNodeIds.add(node.id);
      }
    });

    // 2. Highlight edges and neighbors connected to any matched node
    network.edges.forEach(edge => {
      const sourceMatch = matchedNodeIds.has(edge.source);
      const targetMatch = matchedNodeIds.has(edge.target);
      
      if (sourceMatch || targetMatch) {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
        connectedEdgeIds.add(edge.id);
      }
    });
  } else if (selectedNode !== null) {
    connectedNodeIds.add(selectedNode.id);
    network.edges.forEach(edge => {
      if (edge.source === selectedNode.id) {
        connectedNodeIds.add(edge.target);
        connectedEdgeIds.add(edge.id);
      } else if (edge.target === selectedNode.id) {
        connectedNodeIds.add(edge.source);
        connectedEdgeIds.add(edge.id);
      }
    });

    // For suspects, also highlight accomplice edges and secondary co-accused suspects
    if (selectedNode.type === 'suspect') {
      network.edges.forEach(edge => {
        if (edge.type === 'accomplice' && (edge.source === selectedNode.id || edge.target === selectedNode.id)) {
          connectedNodeIds.add(edge.source);
          connectedNodeIds.add(edge.target);
          connectedEdgeIds.add(edge.id);
        }
      });
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      height: 'calc(100vh - 72px)',
      overflowY: 'auto',
      padding: '1.5rem',
      gap: '1.5rem',
      width: '100%',
      boxSizing: 'border-box'
    }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* 1. TOP KPI Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        flexShrink: 0
      }}>
        {[
          { title: 'Total Registered Cases', value: stats.total_cases, icon: '📂', color: 'var(--accent-blue)', desc: 'Total crimes in database' },
          { title: 'Unique Suspects', value: stats.total_suspects, icon: '👤', color: 'var(--accent-purple)', desc: 'Individuals identified' },
          { title: 'Repeat Offenders', value: stats.repeat_offenders_count, icon: '🔄', color: 'var(--accent-rose)', desc: 'Suspects with ≥ 2 cases' },
          { title: 'Interlinked Cases', value: stats.linked_cases_count, icon: '🕸️', color: 'var(--accent-amber)', desc: 'Cases sharing suspects' },
          { title: 'Organized Crime Gangs', value: stats.organized_cliques_count, icon: '👥', color: 'var(--accent-cyan)', desc: 'Detected co-accused cliques' }
        ].map((item, idx) => (
          <div key={idx} className="glass" style={{
            padding: '1rem 1.25rem',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.2s ease, border-color 0.2s ease'
          }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = item.color;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>{item.title}</span>
              <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '0.25rem' }}>{item.value}</h2>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{item.desc}</span>
            </div>
            <div style={{ fontSize: '2rem', padding: '0.5rem', background: 'var(--input-bg)', borderRadius: '12px' }}>
              {item.icon}
            </div>
          </div>
        ))}
      </div>

      {/* 2. MIDDLE ROW: Interactive Network & Side details */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 8fr) minmax(0, 4fr)',
        gap: '1.25rem',
        height: '520px',
        flexShrink: 0
      }}>
        {/* Network Box */}
        <div className="glass" style={{
          borderRadius: '16px',
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          height: '100%'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.5rem 0.5rem 0.5rem', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)' }}>🛡️ Criminal Linkage & Network Viewer</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Drag nodes to organize. Click a node to filter links and inspect gang/accomplice details.
              </p>
            </div>
            
            {/* Search and Filter Inputs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="🔍 Search name, case, MO..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedNode(null); // Clear selected node so search matches take priority
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.45rem 0.75rem',
                  color: 'var(--text-main)',
                  fontSize: '0.8rem',
                  width: '210px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent-blue)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              />
              
              {(isFiltered || searchQuery) && (
                <button 
                  onClick={() => {
                    setSelectedNode(null);
                    setSearchQuery('');
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(244, 63, 94, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.3)';
                    e.currentTarget.style.color = 'var(--accent-rose)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div style={{ height: '400px', position: 'relative', background: 'var(--bg-dark)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            {/* Floating Zoom Controls */}
            <div style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              zIndex: 5
            }}>
              <button 
                onClick={zoomIn} 
                title="Zoom In"
                style={{
                  width: '28px',
                  height: '28px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-blue)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                +
              </button>
              <button 
                onClick={zoomOut} 
                title="Zoom Out"
                style={{
                  width: '28px',
                  height: '28px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-blue)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                −
              </button>
              <button 
                onClick={resetZoom} 
                title="Reset View"
                style={{
                  width: '28px',
                  height: '28px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-blue)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                ↺
              </button>
            </div>

            <svg 
              ref={svgRef} 
              viewBox="0 0 760 480" 
              onMouseDown={handleSvgMouseDown}
              style={{ width: '100%', height: '100%', cursor: draggedNodeId ? 'grabbing' : (isPanning ? 'move' : 'grab') }}
            >
              {/* Background listener to capture drag pan clicks */}
              <rect id="bg-rect" width="100%" height="100%" fill="none" pointerEvents="all" />
              
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Definitions for arrow markers */}
              <defs>
                <marker id="arrow-case" viewBox="0 0 10 10" refX="18" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#3B82F6" opacity="0.6" />
                </marker>
              </defs>

              {/* Edge Connections */}
              {network.edges.map(edge => {
                const sourceNode = graphNodes.find(n => n.id === edge.source);
                const targetNode = graphNodes.find(n => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                const isEdgeHighlighted = isFiltered ? connectedEdgeIds.has(edge.id) : true;
                const edgeColor = edge.type === 'accomplice' ? 'var(--accent-rose)' : 'var(--accent-blue)';
                const edgeDash = edge.type === 'accomplice' ? '4 3' : 'none';
                
                return (
                  <line
                    key={edge.id}
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={edgeColor}
                    strokeWidth={isEdgeHighlighted ? (edge.type === 'accomplice' ? 2 : 1.5) : 0.4}
                    strokeDasharray={edgeDash}
                    opacity={isEdgeHighlighted ? 0.75 : 0.08}
                    style={{ transition: 'opacity 0.2s, stroke-width 0.2s' }}
                    markerEnd={edge.type === 'accused_in' ? "url(#arrow-case)" : undefined}
                  />
                );
              })}

              {/* Node Circles */}
              {graphNodes.map(node => {
                const isNodeHighlighted = isFiltered ? connectedNodeIds.has(node.id) : true;
                const isRepeatOffender = node.type === 'suspect' && node.val > 20;
                
                let fillColor = 'var(--bg-dark)';
                let strokeColor = 'var(--border-color)';
                
                if (node.type === 'suspect') {
                  fillColor = isRepeatOffender ? '#1E1B4B' : '#111827';
                  strokeColor = isRepeatOffender ? 'var(--accent-rose)' : 'var(--accent-purple)';
                } else {
                  // Color case node based on category
                  if (node.group.includes('Person')) strokeColor = 'var(--accent-blue)';
                  else if (node.group.includes('Property')) strokeColor = 'var(--accent-amber)';
                  else if (node.group.includes('Cyber')) strokeColor = 'var(--accent-cyan)';
                  else strokeColor = 'var(--accent-emerald)';
                  fillColor = '#0F172A';
                }

                // Hover / Select glow
                const isSelected = selectedNode?.id === node.id;
                const isHovered = hoveredNode?.id === node.id;
                const isMatched = matchedNodeIds.has(node.id);
                const glowRadius = isSelected || isHovered || isMatched ? node.val + 4 : node.val;

                return (
                  <g 
                    key={node.id} 
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => setSelectedNode(node)}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onMouseDown={(e) => handleMouseDown(e, node.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Glow outline */}
                    {(isSelected || isHovered || isMatched) && (
                      <circle
                        r={glowRadius}
                        fill="none"
                        stroke={isMatched ? 'var(--accent-amber)' : (node.type === 'suspect' ? 'var(--accent-purple)' : strokeColor)}
                        strokeWidth={isMatched ? 2.5 : 3}
                        strokeDasharray={isMatched ? '3 2' : 'none'}
                        opacity={isMatched ? 0.95 : 0.4}
                      />
                    )}
                    
                    {/* Main Node circle */}
                    <circle
                      r={node.val}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 3 : (isRepeatOffender ? 2.5 : 1.5)}
                      opacity={isNodeHighlighted ? 1 : 0.15}
                      style={{ transition: 'opacity 0.2s, stroke-width 0.2s, r 0.2s' }}
                    />
                    
                    {/* Small Node Icon/Dot */}
                    <circle
                      r={3}
                      fill={node.type === 'suspect' ? 'var(--accent-purple)' : strokeColor}
                      opacity={isNodeHighlighted ? 0.9 : 0.1}
                    />

                    {/* Text Label */}
                    <text
                      y={node.val + 14}
                      textAnchor="middle"
                      fill={isNodeHighlighted ? 'var(--text-main)' : 'var(--text-dim)'}
                      fontSize="9.5"
                      fontWeight={node.type === 'suspect' ? '600' : '400'}
                      opacity={isNodeHighlighted ? 0.9 : 0.1}
                      style={{ pointerEvents: 'none', userSelect: 'none', transition: 'opacity 0.2s' }}
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </g>
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredNode && (
              <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
                maxWidth: '300px',
                pointerEvents: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                whiteSpace: 'pre-line'
              }}>
                <strong style={{ color: hoveredNode.type === 'suspect' ? 'var(--accent-purple)' : 'var(--accent-blue)' }}>
                  {hoveredNode.type === 'suspect' ? '👤 ' + hoveredNode.label : '📂 ' + hoveredNode.label}
                </strong>
                <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {hoveredNode.details}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Detail Sidebar Panel */}
        <div className="glass" style={{
          borderRadius: '16px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflowY: 'auto'
        }}>
          {selectedNode ? (
            <div>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  background: selectedNode.type === 'suspect' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  color: selectedNode.type === 'suspect' ? 'var(--accent-purple)' : 'var(--accent-blue)'
                }}>
                  {selectedNode.type} Profile
                </span>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '0.5rem' }}>
                  {selectedNode.label}
                </h3>
              </div>

              {selectedNode.type === 'suspect' ? (
                // Suspect details
                (() => {
                  const personId = selectedNode.id.replace('suspect_', '');
                  const details = suspects.find(s => s.person_id === personId);
                  if (!details) return <p>Loading details...</p>;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.9rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Person ID:</span>
                        <div style={{ color: 'var(--text-main)', fontWeight: '500', fontFamily: 'var(--font-mono)' }}>{details.person_id}</div>
                      </div>
                      
                      {details.aliases.length > 0 && (
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Known Aliases / Gang Names:</span>
                          <div style={{ color: 'var(--accent-rose)', fontWeight: '500' }}>
                            {details.aliases.join(', ')}
                          </div>
                        </div>
                      )}

                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Age:</span>
                        <div style={{ color: 'var(--text-main)', fontWeight: '500' }}>{details.age || 'Unknown'} Years</div>
                      </div>

                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Associated Crime Incidents ({details.case_count}):</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {details.cases.map((cno, idx) => (
                            <div key={idx} style={{ padding: '0.45rem 0.6rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--accent-blue)', fontWeight: '500', fontSize: '0.85rem' }}>
                              📂 FIR No: {cno}
                            </div>
                          ))}
                        </div>
                      </div>

                      {details.co_accused.length > 0 && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Known Accomplices / Gang Network:</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {details.co_accused.map((cname, idx) => (
                              <span key={idx} style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '12px',
                                background: 'rgba(244, 63, 94, 0.1)',
                                border: '1px solid rgba(244, 63, 94, 0.2)',
                                color: 'var(--accent-rose)',
                                fontSize: '0.75rem',
                                fontWeight: '500'
                              }}>
                                👤 {cname}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                // Case details
                (() => {
                  const caseId = parseInt(selectedNode.id.replace('case_', ''));
                  const details = cases.find(c => c.id === caseId);
                  if (!details) return <p>Loading details...</p>;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.9rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>FIR / Case Number:</span>
                        <div style={{ color: 'var(--text-main)', fontWeight: '600' }}>{details.case_no}</div>
                      </div>

                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Offence Category:</span>
                        <div style={{ color: 'var(--accent-emerald)', fontWeight: '500' }}>{details.category}</div>
                      </div>

                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Registration Date:</span>
                        <div style={{ color: 'var(--text-main)' }}>{details.date}</div>
                      </div>

                      {details.lat && (
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Incident Coordinates:</span>
                          <div style={{ color: 'var(--text-main)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                            📍 Lat: {details.lat.toFixed(4)}, Lon: {details.lon.toFixed(4)}
                          </div>
                        </div>
                      )}

                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Brief Modus Operandi (MO):</span>
                        <div style={{ color: 'var(--text-main)', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '6px', lineHeight: '1.4', fontSize: '0.85rem' }}>
                          {details.brief_facts}
                        </div>
                      </div>

                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Accused in Incident:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {details.accused.map((aname, idx) => (
                            <span key={idx} style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '12px',
                              background: 'rgba(139, 92, 246, 0.1)',
                              border: '1px solid rgba(139, 92, 246, 0.2)',
                              color: 'var(--accent-purple)',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}>
                              👤 {aname}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          ) : (
            // Default sidebar view (List repeat offenders / high-risk nodes)
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                🚨 High-Risk Repeat Offenders
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Suspects linked to multiple cases in current network.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', flex: 1 }}>
                {suspects.filter(s => s.case_count >= 2).map((s, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => {
                      const node = graphNodes.find(n => n.id === `suspect_${s.person_id}`);
                      if (node) setSelectedNode(node);
                    }}
                    style={{
                      padding: '0.6rem 0.75rem',
                      background: 'rgba(244, 63, 94, 0.05)',
                      border: '1px solid rgba(244, 63, 94, 0.15)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'border-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-rose)'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.15)'}
                  >
                    <div>
                      <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem', display: 'block' }}>
                        👤 {s.name}
                      </strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent-rose)', fontWeight: '500' }}>
                        {s.case_count} Offences • ID: {s.person_id}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Inspect ➔</span>
                  </div>
                ))}
              </div>
              
              {cliques.length > 0 && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    👥 Active Gang Networks / Cliques
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {cliques.map((gang, idx) => (
                      <div key={idx} style={{ padding: '0.5rem', background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.15)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-main)' }}>
                        🔗 <strong>Gang {idx + 1}:</strong> {gang.join(', ')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. BOTTOM ROW: Trend Charts */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        marginBottom: '1rem',
        flexShrink: 0
      }}>
        {/* Crime Type Chart */}
        <div className="glass" style={{ borderRadius: '16px', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.75rem' }}>📊 Crime Modus Operandi & Category Distribution</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {trends.categories.map((cat, idx) => {
              const percentage = (cat.count / stats.total_cases) * 100;
              let barColor = 'var(--accent-blue)';
              if (cat.name.includes('Property')) barColor = 'var(--accent-amber)';
              else if (cat.name.includes('Cyber')) barColor = 'var(--accent-cyan)';
              else if (cat.name.includes('Person')) barColor = 'var(--accent-rose)';

              return (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                    <span style={{ color: 'var(--text-main)', fontWeight: '500' }}>{cat.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{cat.count} Cases ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${percentage}%`, background: barColor, borderRadius: '4px', transition: 'width 0.5s ease-out' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
