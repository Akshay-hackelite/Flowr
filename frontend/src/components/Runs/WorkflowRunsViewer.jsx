import { useState, useEffect } from 'react';
import { fetchWorkflowRuns, fetchRunDebugData } from '../../api/client';
import './WorkflowRunsViewer.css';

export default function WorkflowRunsViewer({ workflowId, onClose }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunDebug, setSelectedRunDebug] = useState(null);
  const [debugLoading, setDebugLoading] = useState(false);

  useEffect(() => {
    const loadRuns = async () => {
      try {
        setLoading(true);
        const data = await fetchWorkflowRuns(workflowId, 50);
        // Sort runs by started_at or created_at descending (newest first)
        const sorted = (data || []).sort((a, b) => {
          const timeA = new Date(a.started_at || a.created_at || 0).getTime();
          const timeB = new Date(b.started_at || b.created_at || 0).getTime();
          return timeB - timeA;
        });
        setRuns(sorted);
      } catch (err) {
        console.error('Failed to fetch runs:', err);
      } finally {
        setLoading(false);
      }
    };
    loadRuns();
  }, [workflowId]);

  const handleSelectRun = async (runId) => {
    try {
      setDebugLoading(true);
      const data = await fetchRunDebugData(runId);
      setSelectedRunDebug(data);
    } catch (err) {
      alert('Failed to load execution log: ' + err.message);
    } finally {
      setDebugLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const resolveMessageLabel = (text, allMessages = []) => {
    if (!text) return '[Interactive / Media]';
    if (text.startsWith('opt_') || text.startsWith('row_') || text.startsWith('sec_')) {
      for (const msg of allMessages) {
        const options = msg?.metadata?.options || [];
        const found = options.find(o => o.id === text);
        if (found && found.label) return found.label;
        if (found && found.title) return found.title;
      }
    }
    return text;
  };

  return (
    <div className="runs-drawer-overlay" onClick={onClose}>
      <div className="runs-drawer" onClick={(e) => e.stopPropagation()} style={{ width: '600px', maxWidth: '90vw' }}>
        <div className="runs-drawer__header">
          <div className="runs-drawer__title" style={{ fontSize: '18px', fontWeight: 600 }}>
            ⚡ Workflow Executions Log
          </div>
          <button className="runs-drawer__close" onClick={onClose}>✕</button>
        </div>

        <div className="runs-drawer__body" style={{ padding: '20px', overflowY: 'auto', maxHeight: 'calc(100vh - 80px)' }}>
          {debugLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading inspection data...</div>
          ) : selectedRunDebug ? (
            <div>
              <button
                onClick={() => setSelectedRunDebug(null)}
                style={{
                  padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
                  backgroundColor: '#252538', color: '#fff', cursor: 'pointer', fontSize: '13px',
                  marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                ← Back to Runs List
              </button>

              <div style={{
                backgroundColor: '#1f1f30', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px', padding: '16px', marginBottom: '20px'
              }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#fff', marginBottom: '4px' }}>
                  Run Inspection: <span style={{ color: '#4ecdc4', fontWeight: 'normal' }}>{selectedRunDebug.workflow_run.id}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#888' }}>
                  Contact: <strong style={{ color: '#fff' }}>{selectedRunDebug.workflow_run.contact_phone}</strong> | Status: <span style={{ color: selectedRunDebug.workflow_run.status === 'completed' ? '#4ecdc4' : '#ffc107', textTransform: 'uppercase', fontWeight: 600 }}>{selectedRunDebug.workflow_run.status}</span>
                </div>
              </div>

              <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#1f1f30', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px', fontWeight: 600 }}>Extracted Variables:</div>
                <pre style={{ margin: 0, color: '#4ecdc4', fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap', backgroundColor: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                  {JSON.stringify(selectedRunDebug.workflow_run.variables || {}, null, 2)}
                </pre>
              </div>

              <h4 style={{ margin: '0 0 16px 0', color: '#aaa', fontSize: '14px' }}>Step-by-Step Node Trajectory</h4>
              {(selectedRunDebug.workflow_node_runs || selectedRunDebug.node_runs || []).length === 0 ? (
                <div style={{ fontSize: '13px', color: '#888', fontStyle: 'italic', padding: '8px 0' }}>No nodes traversed yet for this execution.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                  {(selectedRunDebug.workflow_node_runs || selectedRunDebug.node_runs || []).map((nr, idx, arr) => (
                    <div key={nr.id || idx} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: nr.status === 'success' ? 'rgba(78,205,196,0.2)' : 'rgba(255,193,7,0.2)', border: nr.status === 'success' ? '1px solid #4ecdc4' : '1px solid #ffc107', color: nr.status === 'success' ? '#4ecdc4' : '#ffc107', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>
                          {idx + 1}
                        </div>
                        {idx < arr.length - 1 && (
                          <div style={{ width: '2px', flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', margin: '4px 0', minHeight: '16px' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px 16px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <strong style={{ color: '#fff', fontSize: '14px' }}>{nr.node_name || `Node ${nr.node_id}`}</strong>
                          <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: nr.status === 'success' ? 'rgba(78,205,196,0.15)' : 'rgba(255,193,7,0.15)', color: nr.status === 'success' ? '#4ecdc4' : '#ffc107', textTransform: 'uppercase', fontWeight: 600 }}>
                            {nr.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#a0a0b8' }}>Type: <code style={{ color: '#a29bfe' }}>{nr.node_type}</code></div>
                        {nr.user_input && (
                          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#1f1f30', borderRadius: '8px', fontSize: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <span style={{ color: '#888' }}>User Answer ({nr.user_input.variable_name}): </span>
                            <span style={{ color: '#fff', fontWeight: 600 }}>{nr.user_input.value}</span>
                          </div>
                        )}
                        {nr.created_at && <div style={{ fontSize: '11px', color: '#666', marginTop: '6px' }}>{formatDate(nr.created_at)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedRunDebug.messages && selectedRunDebug.messages.length > 0 && (
                <>
                  <h4 style={{ margin: '0 0 12px 0', color: '#aaa', fontSize: '14px' }}>Messages Dispatched</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedRunDebug.messages.map((m) => (
                      <div key={m.id} style={{ padding: '10px 14px', backgroundColor: '#1f1f30', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 600, color: m.direction === 'inbound' ? '#ff8e53' : '#4ecdc4' }}>{m.direction}</span>
                          <span style={{ fontSize: '11px', color: '#666' }}>{formatDate(m.created_at)}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#eee' }}>{resolveMessageLabel(m.text, selectedRunDebug.messages)}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading execution runs...</div>
          ) : runs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>No execution runs yet</div>
              <div style={{ fontSize: '13px', color: '#888' }}>Trigger this workflow by sending a WhatsApp message to your bot!</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '13px', color: '#888', marginBottom: '14px', fontWeight: 600 }}>
                Select an execution to inspect variables and trajectory ({runs.length} runs):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {runs.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => handleSelectRun(r.id)}
                    style={{
                      padding: '14px 16px', backgroundColor: '#1f1f30', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#4ecdc4'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>📱 {r.contact_phone}</span>
                        <span style={{ fontSize: '12px', color: '#888', fontWeight: 'normal' }}>{formatDate(r.started_at || r.created_at)}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#888', fontFamily: 'monospace' }}>
                        {r.id}
                      </div>
                    </div>
                    <div>
                      <span style={{
                        padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                        backgroundColor: r.status === 'completed' ? 'rgba(78, 205, 196, 0.15)' : r.status === 'waiting_for_user' ? 'rgba(255, 193, 7, 0.15)' : 'rgba(33, 150, 243, 0.15)',
                        color: r.status === 'completed' ? '#4ecdc4' : r.status === 'waiting_for_user' ? '#ffc107' : '#2196f3',
                        textTransform: 'uppercase'
                      }}>
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
