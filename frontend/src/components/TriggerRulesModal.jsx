import React, { useState, useEffect } from 'react';
import { fetchTriggerRules, saveTriggerRule, deleteTriggerRule } from '../api/client';

export default function TriggerRulesModal({ isOpen, onClose, clientId, workflows }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [matchType, setMatchType] = useState('exact');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [error, setError] = useState('');

  const loadRules = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const data = await fetchTriggerRules(clientId);
      setRules(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRules();
      if (workflows && workflows.length > 0 && !selectedWorkflowId) {
        setSelectedWorkflowId(workflows[0].id);
      }
    }
  }, [isOpen, clientId, workflows]);

  if (!isOpen) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!keyword.trim() || !selectedWorkflowId) {
      setError('Please provide a keyword and select a workflow.');
      return;
    }
    setError('');
    try {
      const newRule = {
        id: `rule_${Date.now()}`,
        client_id: clientId,
        keyword: keyword.trim(),
        match_type: matchType,
        workflow_id: selectedWorkflowId,
        is_active: true,
      };
      await saveTriggerRule(newRule);
      setKeyword('');
      await loadRules();
    } catch (err) {
      setError(err.message || 'Failed to save rule');
    }
  };

  const handleToggle = async (rule) => {
    try {
      const updated = { ...rule, is_active: !rule.is_active };
      await saveTriggerRule(updated);
      setRules(rules.map((r) => (r.id === rule.id ? updated : r)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteTriggerRule(id);
      setRules(rules.filter((r) => r.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const getWorkflowName = (id) => {
    const wf = workflows.find((w) => w.id === id);
    return wf ? wf.name : id;
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(10, 10, 18, 0.85)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#161622', border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px', width: '650px', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)', color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚡</span> Trigger Rules Routing
            </h2>
            <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0 0' }}>
              Route incoming WhatsApp messages to specific workflows based on trigger keywords.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{ padding: '10px 14px', backgroundColor: 'rgba(255,87,34,0.15)', border: '1px solid #ff5722', borderRadius: '8px', color: '#ff8a65', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleCreate} style={{ backgroundColor: '#1f1f30', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#4ecdc4' }}>+ Add New Trigger Rule</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Trigger keyword (e.g. 'support')"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#161622', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', fontSize: '13px' }}
              />
              <select
                value={matchType}
                onChange={(e) => setMatchType(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#161622', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', fontSize: '13px' }}
              >
                <option value="exact">Exact Match</option>
                <option value="contains">Contains</option>
              </select>
              <select
                value={selectedWorkflowId}
                onChange={(e) => setSelectedWorkflowId(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#161622', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', fontSize: '13px' }}
              >
                {workflows.map((wf) => (
                  <option key={wf.id} value={wf.id}>
                    {wf.name} ({wf.status})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #4ecdc4, #556270)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
              >
                Add Rule
              </button>
            </div>
          </form>

          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#aaa' }}>Active Routing Rules</h4>
          {loading ? (
            <p style={{ color: '#666' }}>Loading rules...</p>
          ) : rules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', backgroundColor: '#1f1f30', borderRadius: '12px', color: '#666', fontSize: '14px' }}>
              No trigger rules set up yet. When no rules match, messages route to your default published workflow.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rules.map((rule) => (
                <div key={rule.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', backgroundColor: '#1f1f30', borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                      backgroundColor: rule.match_type === 'exact' ? 'rgba(78, 205, 196, 0.15)' : 'rgba(255, 193, 7, 0.15)',
                      color: rule.match_type === 'exact' ? '#4ecdc4' : '#ffc107',
                    }}>
                      {rule.match_type.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '15px', fontWeight: 600 }}>"{rule.keyword}"</span>
                    <span style={{ color: '#666' }}>→</span>
                    <span style={{ color: '#ddd', fontSize: '14px' }}>{getWorkflowName(rule.workflow_id)}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div
                      onClick={() => handleToggle(rule)}
                      style={{
                        width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
                        backgroundColor: rule.is_active ? '#4ecdc4' : '#333', position: 'relative',
                        transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', padding: '2px',
                      }}
                      title={rule.is_active ? 'Rule ON (Click to disable)' : 'Rule OFF (Click to enable)'}
                    >
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#fff',
                        transform: rule.is_active ? 'translateX(20px)' : 'translateX(0)',
                        transition: 'transform 0.2s',
                      }} />
                    </div>

                    <button
                      onClick={() => handleDelete(rule.id)}
                      style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '16px' }}
                      title="Delete rule"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
