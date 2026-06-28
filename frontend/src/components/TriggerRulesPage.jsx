import { useState, useEffect } from 'react';
import { fetchTriggerRules, saveTriggerRule, deleteTriggerRule } from '../api/client';

export default function TriggerRulesPage({ clientId, workflows = [] }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);

  // Form states for new/editing rule
  const [keyword, setKeyword] = useState('');
  const [matchType, setMatchType] = useState('exact');
  const [targetWorkflowId, setTargetWorkflowId] = useState(workflows[0]?.id || '');
  const [isActive, setIsActive] = useState(true);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await fetchTriggerRules(clientId);
      setRules(data || []);
    } catch (err) {
      console.error('Failed to load trigger rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, [clientId]);

  const handleToggleActive = async (e, rule) => {
    e.stopPropagation();
    const updatedStatus = rule.is_active === false ? true : false;
    const updatedRule = { ...rule, workflow_id: rule.workflow_id || rule.target_workflow_id, target_workflow_id: rule.workflow_id || rule.target_workflow_id, is_active: updatedStatus };
    try {
      await saveTriggerRule(updatedRule);
      setRules(rules.map(r => r.id === rule.id ? { ...r, is_active: updatedStatus } : r));
    } catch (err) {
      alert('Failed to update trigger rule: ' + err.message);
    }
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!keyword.trim() || !targetWorkflowId) {
      alert('Please enter a keyword and select a workflow.');
      return;
    }
    const ruleId = selectedRule ? selectedRule.id : `rule_${Date.now()}`;
    const newRule = {
      id: ruleId,
      client_id: clientId,
      keyword: keyword.trim().toLowerCase(),
      match_type: matchType,
      workflow_id: targetWorkflowId,
      target_workflow_id: targetWorkflowId,
      is_active: isActive
    };

    try {
      await saveTriggerRule(newRule);
      setShowCreateModal(false);
      setSelectedRule(null);
      setKeyword('');
      loadRules();
    } catch (err) {
      alert('Failed to save trigger rule: ' + err.message);
    }
  };

  const openCreateModal = () => {
    setSelectedRule(null);
    setKeyword('');
    setMatchType('exact');
    setTargetWorkflowId(workflows[0]?.id || '');
    setIsActive(true);
    setShowCreateModal(true);
  };

  const openDetailModal = (rule) => {
    setSelectedRule(rule);
    setKeyword(rule.keyword);
    setMatchType(rule.match_type || 'exact');
    setTargetWorkflowId(rule.workflow_id || rule.target_workflow_id);
    setIsActive(rule.is_active !== false);
    setShowCreateModal(true);
  };

  const handleDelete = async (e, ruleId) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this trigger rule?')) return;
    try {
      await deleteTriggerRule(ruleId);
      loadRules();
      if (selectedRule?.id === ruleId) setShowCreateModal(false);
    } catch (err) {
      alert('Failed to delete rule: ' + err.message);
    }
  };

  return (
    <div style={{ padding: '32px 48px', color: '#fff', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', background: 'linear-gradient(90deg, #4ecdc4, #556270)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ⚡ Trigger Rules
          </h1>
          <p style={{ margin: '8px 0 0', color: '#a0a0b8', fontSize: '14px' }}>
            Configure automatic keyword triggers to route incoming WhatsApp messages directly to specific workflows.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          style={{
            background: 'linear-gradient(135deg, #4ecdc4, #2abb9b)',
            color: '#0a0a12',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '10px',
            fontWeight: '700',
            fontSize: '15px',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(78, 205, 196, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>+</span> Create Rule
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Loading trigger rules...</div>
      ) : rules.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px dashed rgba(255,255,255,0.15)',
          borderRadius: '16px',
          padding: '60px 20px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎯</div>
          <h3 style={{ margin: '0 0 8px', fontSize: '18px' }}>No trigger rules configured yet</h3>
          <p style={{ color: '#888', maxWidth: '400px', margin: '0 auto 24px', fontSize: '14px' }}>
            When a customer sends a message matching your rules, Flowr will automatically launch the specified workflow.
          </p>
          <button
            onClick={openCreateModal}
            style={{
              background: 'rgba(78,205,196,0.1)',
              color: '#4ecdc4',
              border: '1px solid rgba(78,205,196,0.3)',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Create Your First Rule
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {rules.map((rule) => {
            const active = rule.is_active !== false;
            const wfId = rule.workflow_id || rule.target_workflow_id;
            const targetWf = workflows.find(w => w.id === wfId);
            return (
              <div
                key={rule.id}
                onClick={() => openDetailModal(rule)}
                style={{
                  background: active ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                  border: active ? '1px solid rgba(78,205,196,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                  padding: '24px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  opacity: active ? 1 : 0.6
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <span style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      background: rule.match_type === 'exact' ? 'rgba(108,92,231,0.2)' : 'rgba(255,193,7,0.2)',
                      color: rule.match_type === 'exact' ? '#a29bfe' : '#ffc107',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontWeight: '700'
                    }}>
                      {rule.match_type || 'exact'} match
                    </span>
                    <h3 style={{ margin: '12px 0 4px', fontSize: '20px', color: '#fff', fontFamily: 'monospace' }}>
                      "{rule.keyword}"
                    </h3>
                  </div>

                  {/* ON/OFF Toggle Switch */}
                  <div
                    onClick={(e) => handleToggleActive(e, rule)}
                    title={active ? 'Rule is ON (Click to disable)' : 'Rule is OFF (Click to enable)'}
                    style={{
                      width: '48px',
                      height: '26px',
                      backgroundColor: active ? '#4ecdc4' : '#333',
                      borderRadius: '13px',
                      padding: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: active ? 'flex-end' : 'flex-start',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: '#fff',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </div>

                <div style={{ fontSize: '13px', color: '#888', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Routes to: <strong style={{ color: '#e0e0e0' }}>{targetWf ? targetWf.name : (rule.workflow_id || rule.target_workflow_id)}</strong></span>
                  <button
                    onClick={(e) => handleDelete(e, rule.id)}
                    style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '14px' }}
                    title="Delete Rule"
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Rule Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowCreateModal(false)}>
          <div style={{
            background: '#161625', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '480px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>
                {selectedRule ? 'Edit Trigger Rule' : 'Create Trigger Rule'}
              </h2>
              <button
                onClick={handleSaveRule}
                style={{
                  background: '#4ecdc4', color: '#000', border: 'none', padding: '8px 20px',
                  borderRadius: '8px', fontWeight: '700', cursor: 'pointer'
                }}
              >
                💾 Save Rule
              </button>
            </div>

            <form onSubmit={handleSaveRule} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>Trigger Keyword</label>
                <input
                  type="text"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  placeholder="e.g. support, refund, pricing"
                  style={{
                    width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: '#fff', fontSize: '15px'
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>Match Type</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{
                    flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
                    border: matchType === 'exact' ? '1px solid #4ecdc4' : '1px solid rgba(255,255,255,0.1)',
                    background: matchType === 'exact' ? 'rgba(78,205,196,0.1)' : 'transparent',
                    color: matchType === 'exact' ? '#4ecdc4' : '#888'
                  }}>
                    <input type="radio" name="matchType" value="exact" checked={matchType === 'exact'} onChange={() => setMatchType('exact')} style={{ display: 'none' }} />
                    Exact Match
                  </label>
                  <label style={{
                    flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
                    border: matchType === 'contains' ? '1px solid #4ecdc4' : '1px solid rgba(255,255,255,0.1)',
                    background: matchType === 'contains' ? 'rgba(78,205,196,0.1)' : 'transparent',
                    color: matchType === 'contains' ? '#4ecdc4' : '#888'
                  }}>
                    <input type="radio" name="matchType" value="contains" checked={matchType === 'contains'} onChange={() => setMatchType('contains')} style={{ display: 'none' }} />
                    Contains Word
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>Target Workflow</label>
                <select
                  value={targetWorkflowId}
                  onChange={e => setTargetWorkflowId(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 16px', background: '#1f1f33',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: '#fff', fontSize: '15px'
                  }}
                >
                  {workflows.map(wf => (
                    <option key={wf.id} value={wf.id}>{wf.name} ({wf.status})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize: '14px', color: '#ccc' }}>Enforce this rule immediately</span>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                  <span style={{ color: isActive ? '#4ecdc4' : '#888', fontWeight: '600' }}>{isActive ? 'Active' : 'Disabled'}</span>
                </label>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
