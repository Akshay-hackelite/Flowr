import React, { useState, useEffect } from 'react';
import { fetchAllRuns, fetchRunDebugData } from '../api/client';

export default function AllExecutionsTab({ clientId, workflows, onOpenWorkflowExecutions }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState(null);
  const [debugData, setDebugData] = useState(null);
  const [debugLoading, setDebugLoading] = useState(false);

  const loadRuns = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const data = await fetchAllRuns(clientId, 100);
      setRuns(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
    const timer = setInterval(loadRuns, 5000);
    return () => clearInterval(timer);
  }, [clientId]);

  const handleSelectRun = async (run) => {
    setSelectedRun(run);
    setDebugLoading(true);
    try {
      const data = await fetchRunDebugData(run.id);
      setDebugData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setDebugLoading(false);
    }
  };

  const getWorkflowName = (wfId) => {
    const wf = workflows.find((w) => w.id === wfId);
    return wf ? wf.name : wfId;
  };

  const formatTime = (ts) => {
    if (!ts) return 'N/A';
    return new Date(ts).toLocaleString();
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', margin: 0 }}>⚡ All Workflow Executions</h1>
          <p style={{ color: '#888', fontSize: '14px', margin: '4px 0 0 0' }}>
            Real-time global log of all customer interactions across your published and draft workflows.
          </p>
        </div>
        <button
          onClick={loadRuns}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: '#1f1f30', color: '#fff', cursor: 'pointer', fontSize: '13px',
          }}
        >
          🔄 Refresh List
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedRun ? '1fr 1fr' : '1fr', gap: '24px' }}>
        <div style={{
          backgroundColor: '#161622', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px', overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#1f1f30', fontWeight: 600 }}>
            Recent Executions ({runs.length})
          </div>

          {loading && runs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading executions...</div>
          ) : runs.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#666' }}>
              No workflow runs yet. Send a WhatsApp message to your bot to start an execution!
            </div>
          ) : (
            <div style={{ maxHeight: '700px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#888' }}>
                    <th style={{ padding: '12px 16px' }}>Workflow</th>
                    <th style={{ padding: '12px 16px' }}>Contact Phone</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px' }}>Started At</th>
                    <th style={{ padding: '12px 16px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      onClick={() => handleSelectRun(run)}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        backgroundColor: selectedRun?.id === run.id ? 'rgba(78, 205, 196, 0.1)' : 'transparent',
                        cursor: 'pointer', transition: 'background-color 0.2s',
                      }}
                    >
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: '#4ecdc4' }}>
                        {getWorkflowName(run.workflow_id)}
                      </td>
                      <td style={{ padding: '14px 16px' }}>{run.contact_phone}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                          backgroundColor: run.status === 'completed' ? 'rgba(78, 205, 196, 0.15)' : run.status === 'waiting_for_user' ? 'rgba(255, 193, 7, 0.15)' : 'rgba(33, 150, 243, 0.15)',
                          color: run.status === 'completed' ? '#4ecdc4' : run.status === 'waiting_for_user' ? '#ffc107' : '#2196f3',
                        }}>
                          {run.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#888' }}>{formatTime(run.started_at)}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenWorkflowExecutions(run.workflow_id); }}
                          style={{
                            padding: '4px 10px', borderRadius: '6px', border: 'none',
                            backgroundColor: '#252538', color: '#ddd', cursor: 'pointer', fontSize: '11px',
                          }}
                        >
                          Filter Workflow
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedRun && (
          <div style={{
            backgroundColor: '#161622', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#1f1f30',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontWeight: 600 }}>Run Inspection: {selectedRun.id}</span>
              <button onClick={() => setSelectedRun(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', maxHeight: '650px', fontSize: '13px' }}>
              <div style={{ marginBottom: '20px', padding: '14px', backgroundColor: '#1f1f30', borderRadius: '10px' }}>
                <div style={{ color: '#888', marginBottom: '6px' }}>Extracted Variables:</div>
                <pre style={{ margin: 0, color: '#4ecdc4', fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(selectedRun.variables || {}, null, 2)}
                </pre>
              </div>

              <h4 style={{ margin: '0 0 16px 0', color: '#aaa' }}>Step-by-Step Node Trajectory</h4>
              {debugLoading ? (
                <div style={{ color: '#666' }}>Loading trajectory...</div>
              ) : !debugData ? (
                <div style={{ color: '#666' }}>No trajectory data available.</div>
              ) : (debugData.workflow_node_runs || debugData.node_runs || []).length === 0 ? (
                <div style={{ color: '#888', fontStyle: 'italic' }}>No steps recorded for this execution yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(debugData.workflow_node_runs || debugData.node_runs || []).map((nr, idx, arr) => (
                    <div key={nr.id || idx} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: nr.status === 'success' ? 'rgba(78,205,196,0.2)' : 'rgba(255,193,7,0.2)', border: nr.status === 'success' ? '1px solid #4ecdc4' : '1px solid #ffc107', color: nr.status === 'success' ? '#4ecdc4' : '#ffc107', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>
                          {idx + 1}
                        </div>
                        {idx < arr.length - 1 && (
                          <div style={{ width: '2px', flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', margin: '4px 0', minHeight: '16px' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px 14px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <strong style={{ color: '#fff', fontSize: '14px' }}>{nr.node_name || `Node ${nr.node_id}`}</strong>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: nr.status === 'success' ? 'rgba(78,205,196,0.15)' : 'rgba(255,193,7,0.15)', color: nr.status === 'success' ? '#4ecdc4' : '#ffc107', textTransform: 'uppercase', fontWeight: 600 }}>
                            {nr.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#a0a0b8' }}>Type: <code style={{ color: '#a29bfe' }}>{nr.node_type}</code></div>
                        {nr.user_input && (
                          <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#1f1f30', borderRadius: '6px', fontSize: '12px' }}>
                            <span style={{ color: '#888' }}>User Answer ({nr.user_input.variable_name}): </span>
                            <span style={{ color: '#fff', fontWeight: 600 }}>{nr.user_input.value}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
