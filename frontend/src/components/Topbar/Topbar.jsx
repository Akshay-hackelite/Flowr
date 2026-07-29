import { useState } from 'react';
import './Topbar.css';

export default function Topbar({
  workflowName,
  isDefault,
  onNameChange,
  onSave,
  onOpenRuns,
  onOpenTriggerSettings,
  saveStatus,
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
        {isDefault && (
          <span className="topbar__status-badge" style={{ backgroundColor: 'rgba(78, 205, 196, 0.15)', color: '#4ecdc4' }}>
            ⭐ Default
          </span>
        )}
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

        <button
          className="topbar__btn"
          style={{ backgroundColor: 'rgba(255,193,7,0.15)', color: '#ffc107', border: '1px solid rgba(255,193,7,0.3)' }}
          onClick={onOpenTriggerSettings}
        >
          🎯 Trigger Settings
        </button>
      </div>
    </header>
  );
}
