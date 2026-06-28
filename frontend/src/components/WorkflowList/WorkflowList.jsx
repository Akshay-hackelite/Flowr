import { useState, useEffect } from 'react';
import { fetchWorkflows, createWorkflow, deleteWorkflow } from '../../api/client';
import './WorkflowList.css';

export default function WorkflowList({
  onSelectWorkflow,
  onOpenInbox,
  onOpenAllExecutions,
  onOpenTriggerRules,
  authUser,
  clientId,
  whatsappAccountId,
  userId,
  onOpenWorkflowExecutions,
  onLogout,
}) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const loadWorkflows = async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      const data = await fetchWorkflows(clientId);
      setWorkflows(data);
    } catch (err) {
      console.error('Failed to load workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, [clientId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      setCreating(true);
      const result = await createWorkflow({
        clientId,
        whatsappAccountId,
        userId,
        name: newName.trim(),
        description: newDesc.trim() || null,
      });
      setShowCreateModal(false);
      setNewName('');
      setNewDesc('');
      onSelectWorkflow(result.workflow.id);
    } catch (err) {
      alert('Failed to create workflow: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e, workflowId) => {
    e.stopPropagation();
    if (!confirm('Delete this workflow?')) return;
    try {
      await deleteWorkflow(workflowId);
      loadWorkflows();
    } catch (err) {
      alert('Failed to delete workflow: ' + err.message);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="workflow-list">
      <div className="workflow-list__header">
        <div className="workflow-list__header-left">
          <div>
            <div className="workflow-list__brand" style={{ fontSize: '24px' }}>Workflows</div>
            <div className="workflow-list__subtitle">Manage and build your automated WhatsApp flows</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="workflow-list__create-btn" onClick={() => setShowCreateModal(true)}>
            ✦ New Workflow
          </button>
        </div>
      </div>

      <div className="workflow-list__content">
        {loading ? (
          <div className="workflow-list__loading">
            <div className="workflow-list__loading-spinner" />
            <div>Loading workflows...</div>
          </div>
        ) : workflows.length === 0 ? (
          <div className="workflow-list__empty">
            <div className="workflow-list__empty-icon">📋</div>
            <div className="workflow-list__empty-title">No workflows yet</div>
            <div className="workflow-list__empty-desc">
              Create your first workflow to start automating WhatsApp conversations, or use the <code>/dev/setup</code> API endpoint to create one via JSON.
            </div>
            <button className="workflow-list__create-btn" onClick={() => setShowCreateModal(true)}>
              ✦ Create Your First Workflow
            </button>
          </div>
        ) : (
          <div className="workflow-list__grid">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                onClick={() => { window.location.hash = `#/workflow/${encodeURIComponent(wf.id)}`; }}
                className="workflow-card"
                style={{ color: 'inherit', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
              >
                <div className="workflow-card__top">
                  <a
                    href={`#/workflow/${encodeURIComponent(wf.id)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="workflow-card__name"
                    style={{ textDecoration: 'none', color: '#fff' }}
                  >
                    {wf.name}
                  </a>
                  <span className={`workflow-card__status workflow-card__status--${wf.status}`}>
                    {wf.status}
                  </span>
                </div>
                <div className="workflow-card__desc">
                  {wf.description || 'No description'}
                </div>
                <div className="workflow-card__meta">
                  <span className="workflow-card__meta-item">
                    📐 {(wf.node_ids || []).length} nodes
                  </span>
                  <span className="workflow-card__meta-item">
                    📅 {formatDate(wf.updated_at)}
                  </span>
                </div>
                <div className="workflow-card__actions" style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                  <a
                    href={`#/workflow/${encodeURIComponent(wf.id)}`}
                    className="workflow-card__action-btn"
                    style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}
                  >
                    ✏️ Edit
                  </a>
                  <a
                    href={`#/workflow/${encodeURIComponent(wf.id)}/runs`}
                    className="workflow-card__action-btn"
                    style={{ flex: 1, backgroundColor: 'rgba(255,193,7,0.15)', color: '#ffc107', border: '1px solid rgba(255,193,7,0.3)', textDecoration: 'none', textAlign: 'center' }}
                  >
                    ⚡ Runs
                  </a>
                  <button
                    className="workflow-card__action-btn workflow-card__action-btn--delete"
                    onClick={(e) => handleDelete(e, wf.id)}
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__title">✦ Create New Workflow</div>
            <div className="modal__field">
              <label className="modal__label">Workflow Name</label>
              <input
                className="modal__input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Order Support Bot"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="modal__field">
              <label className="modal__label">Description (optional)</label>
              <input
                className="modal__input"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Describe what this workflow does..."
              />
            </div>
            <div className="modal__actions">
              <button className="modal__btn modal__btn--cancel" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button
                className="modal__btn modal__btn--create"
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
              >
                {creating ? 'Creating...' : 'Create Workflow'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
