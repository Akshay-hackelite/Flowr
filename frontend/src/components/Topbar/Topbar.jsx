import { useState } from 'react';
import './Topbar.css';

export default function Topbar({
  workflowName,
  workflowStatus,
  onNameChange,
  onSave,
  onPublish,
  onUnpublish,
  onBack,
  onOpenRuns,
  saveStatus, // 'idle' | 'saving' | 'saved' | 'error'
  isSaving,
}) {
  return (
    <header className="topbar">
      <a href="#/" className="topbar__logo" style={{ textDecoration: 'none' }} title="Back to workflows">
        <div className="topbar__logo-icon">🌊</div>
        <span>Flowr</span>
      </a>

      <div className="topbar__divider" />

      <a href="#/" className="topbar__back-btn" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
        ← Workflows
      </a>

      <div className="topbar__divider" />

      <div className="topbar__workflow-name">
        <input
          type="text"
          value={workflowName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Workflow name..."
        />
        <span className={`topbar__status-badge topbar__status-badge--${workflowStatus}`}>
          {workflowStatus}
        </span>
      </div>

      <div className="topbar__actions">
        {saveStatus && (
          <span className={`topbar__save-status topbar__save-status--${saveStatus}`}>
            {saveStatus === 'saving' && '⟳ Saving...'}
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'error' && '✕ Error saving'}
          </span>
        )}

        <button
          className="topbar__btn topbar__btn--secondary"
          onClick={onOpenRuns}
        >
          ⚡ Executions
        </button>

        <button
          className="topbar__btn topbar__btn--secondary"
          onClick={onSave}
          disabled={isSaving}
        >
          💾 Save
        </button>

        {workflowStatus === 'published' ? (
          <button
            className="topbar__btn topbar__btn--danger"
            onClick={onUnpublish}
          >
            ⏸ Unpublish
          </button>
        ) : (
          <button
            className="topbar__btn topbar__btn--publish"
            onClick={onPublish}
          >
            🚀 Publish
          </button>
        )}
      </div>
    </header>
  );
}
