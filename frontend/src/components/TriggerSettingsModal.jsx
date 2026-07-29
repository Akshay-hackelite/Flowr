import React, { useState, useEffect } from 'react';
import { updateWorkflow } from '../api/client';

export default function TriggerSettingsModal({ isOpen, onClose, workflow, workflows, onWorkflowChange, onSaved }) {
  const [triggerOn, setTriggerOn] = useState(false);
  const [keywords, setKeywords] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && workflow) {
      setTriggerOn(workflow.trigger_on || false);
      setKeywords(workflow.trigger_keywords || []);
    }
  }, [isOpen, workflow]);

  if (!isOpen || !workflow) return null;

  const handleAddKeyword = () => {
    setKeywords([...keywords, { keyword: '', match_type: 'exact', fuzzy_threshold: 80 }]);
  };

  const handleRemoveKeyword = (index) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const handleChangeKeyword = (index, field, value) => {
    const newKeywords = [...keywords];
    newKeywords[index][field] = value;
    setKeywords(newKeywords);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      // Validation
      for (const kw of keywords) {
        if (!kw.keyword.trim()) {
          throw new Error("Keyword cannot be empty.");
        }
      }
      await updateWorkflow(workflow.id, {
        trigger_on: triggerOn,
        trigger_keywords: keywords
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save trigger settings');
    } finally {
      setSaving(false);
    }
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
              <span>🎯</span> Trigger Settings
              {workflows && workflows.length > 0 ? (
                <select
                  value={workflow.id}
                  onChange={(e) => {
                    const selected = workflows.find(w => w.id === e.target.value);
                    if (selected && onWorkflowChange) {
                      onWorkflowChange(selected);
                    }
                  }}
                  style={{
                    marginLeft: '8px',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '16px',
                    cursor: 'pointer'
                  }}
                >
                  {workflows.map(wf => (
                    <option key={wf.id} value={wf.id}>{wf.name}</option>
                  ))}
                </select>
              ) : (
                <span>: {workflow.name}</span>
              )}
            </h2>
            <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0 0' }}>
              Configure keywords to automatically start this workflow.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{ backgroundColor: 'rgba(255, 68, 68, 0.1)', color: '#ff4444', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Enable Triggers</div>
              <div style={{ fontSize: '13px', color: '#888' }}>Allow this workflow to be triggered by keywords</div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px' }}>
              <input 
                type="checkbox" 
                checked={triggerOn} 
                onChange={(e) => setTriggerOn(e.target.checked)} 
                style={{ opacity: 0, width: 0, height: 0 }} 
              />
              <span style={{
                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: triggerOn ? '#4ecdc4' : 'rgba(255,255,255,0.1)',
                transition: '.4s', borderRadius: '34px'
              }}>
                <span style={{
                  position: 'absolute', content: '""', height: '18px', width: '18px',
                  left: '4px', bottom: '4px', backgroundColor: 'white',
                  transition: '.4s', borderRadius: '50%',
                  transform: triggerOn ? 'translateX(22px)' : 'none'
                }} />
              </span>
            </label>
          </div>

          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>Keywords</div>
            <button
              onClick={handleAddKeyword}
              style={{ background: 'rgba(78,205,196,0.1)', color: '#4ecdc4', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              + Add Keyword
            </button>
          </div>

          {keywords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', color: '#888', fontSize: '14px' }}>
              No keywords configured. Click "+ Add Keyword" to create one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {keywords.map((kw, index) => (
                <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <input
                    type="text"
                    value={kw.keyword}
                    onChange={(e) => handleChangeKeyword(index, 'keyword', e.target.value)}
                    placeholder="Enter keyword..."
                    style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '6px', color: '#fff', fontSize: '14px' }}
                  />
                  <select
                    value={kw.match_type}
                    onChange={(e) => handleChangeKeyword(index, 'match_type', e.target.value)}
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '6px', color: '#fff', fontSize: '14px', width: '120px' }}
                  >
                    <option value="exact">Exact Match</option>
                    <option value="fuzzy">Fuzzy Match</option>
                  </select>
                  {kw.match_type === 'fuzzy' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#888' }}>Threshold %:</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={kw.fuzzy_threshold}
                        onChange={(e) => handleChangeKeyword(index, 'fuzzy_threshold', parseInt(e.target.value))}
                        style={{ width: '60px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '6px', color: '#fff', fontSize: '14px' }}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => handleRemoveKeyword(index)}
                    style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '4px', fontSize: '16px' }}
                    title="Remove keyword"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'rgba(0,0,0,0.2)' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#4ecdc4', color: '#000', cursor: 'pointer', fontWeight: 700 }}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
