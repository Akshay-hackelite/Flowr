import { useState, useMemo } from 'react';
import TriggerSettingsModal from './TriggerSettingsModal';

export default function TriggerRulesPage({ clientId, workflows = [] }) {
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const rules = useMemo(() => {
    const allRules = [];
    workflows.forEach(wf => {
      if (wf.trigger_keywords) {
        wf.trigger_keywords.forEach((kw, idx) => {
          allRules.push({
            id: `${wf.id}-${idx}`,
            keyword: kw.keyword,
            match_type: kw.match_type,
            fuzzy_threshold: kw.fuzzy_threshold,
            workflow_id: wf.id,
            workflow_name: wf.name,
            is_active: wf.trigger_on
          });
        });
      }
    });
    return allRules;
  }, [workflows]);

  const openCreateModal = () => {
    setSelectedWorkflow(workflows[0] || null);
    setShowSettingsModal(true);
  };

  const openDetailModal = (wfId) => {
    const wf = workflows.find(w => w.id === wfId);
    if (wf) {
      setSelectedWorkflow(wf);
      setShowSettingsModal(true);
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


      {rules.length === 0 ? (
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
          {rules.map((rule) => (
            <div
              key={rule.id}
              onClick={() => openDetailModal(rule.workflow_id)}
              style={{
                background: rule.is_active ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                border: rule.is_active ? '1px solid rgba(78,205,196,0.3)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                padding: '24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                opacity: rule.is_active ? 1 : 0.6
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
              </div>

              <div style={{ fontSize: '13px', color: '#888', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Routes to: <strong style={{ color: '#e0e0e0' }}>{rule.workflow_name}</strong></span>
                {!rule.is_active && <span style={{ color: '#ff6b6b' }}>Disabled</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showSettingsModal && selectedWorkflow && (
        <TriggerSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          workflow={selectedWorkflow}
          workflows={workflows}
          onWorkflowChange={(wf) => setSelectedWorkflow(wf)}
          onSaved={() => window.location.reload()}
        />
      )}
    </div>
  );
}
