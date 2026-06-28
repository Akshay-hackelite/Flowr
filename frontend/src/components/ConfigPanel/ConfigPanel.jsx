import { useState } from 'react';
import { NODE_COLORS } from '../../constants';
import './ConfigPanel.css';

function VariablesPicker({ onSelect, userCreatedVars = [] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'linear-gradient(135deg, rgba(78,205,196,0.15), rgba(78,205,196,0.05))',
          border: '1px solid #4ecdc4',
          color: '#4ecdc4',
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
        title="Insert dynamic variable"
      >
        <span>{'{ }'}</span> Variables ▾
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: '4px',
            backgroundColor: '#1a1a2e',
            border: '1px solid rgba(78,205,196,0.4)',
            borderRadius: '8px',
            padding: '8px',
            zIndex: 1000,
            minWidth: '180px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <div style={{ fontSize: '10px', color: '#888', padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            User Created Variables
          </div>
          {userCreatedVars.length === 0 ? (
            <div style={{ fontSize: '11px', color: '#666', padding: '4px 6px', fontStyle: 'italic' }}>
              No custom variables created in previous nodes
            </div>
          ) : (
            userCreatedVars.map(v => (
              <button
                key={v}
                type="button"
                onClick={() => { onSelect(v); setIsOpen(false); }}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: 'none',
                  color: '#4ecdc4',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  textAlign: 'left',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontFamily: 'monospace'
                }}
              >
                + @{v}
              </button>
            ))
          )}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '4px 0' }} />
          <div style={{ fontSize: '10px', color: '#888', padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            System Variables
          </div>
          <button
            type="button"
            onClick={() => { onSelect('contact_phone'); setIsOpen(false); }}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: 'none',
              color: '#a29bfe',
              padding: '6px 8px',
              borderRadius: '4px',
              textAlign: 'left',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'monospace'
            }}
          >
            + @contact_phone
          </button>
        </div>
      )}
    </div>
  );
}

export default function ConfigPanel({ selectedNode, onUpdateNode, onDeleteNode, onClose, nodes = [] }) {
  if (!selectedNode) return null;

  const { data, type } = selectedNode;
  const config = data?.config || {};
  const nodeColor = NODE_COLORS[type] || NODE_COLORS.send_message;

  // Calculate variables created by user in previous nodes
  const userCreatedVars = Array.from(new Set(
    nodes
      .filter(n => n.id !== selectedNode.id && n.data?.config?.variable_name)
      .map(n => n.data.config.variable_name.trim())
      .filter(Boolean)
  ));

  const updateConfig = (key, value) => {
    const newConfig = { ...config, [key]: value };
    onUpdateNode(selectedNode.id, {
      ...data,
      config: newConfig,
    });
  };

  const updateLabel = (label) => {
    onUpdateNode(selectedNode.id, { ...data, label });
  };

  return (
    <div className="config-panel">
      <div className="config-panel__header">
        <div className="config-panel__header-left">
          <div className="config-panel__icon" style={{ background: nodeColor.bg }}>
            {nodeColor.icon}
          </div>
          <div>
            <div className="config-panel__header-title">{data.label || nodeColor.label}</div>
            <div className="config-panel__header-type">{type}</div>
          </div>
        </div>
        <button className="config-panel__close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="config-panel__body">
        {/* Node Name */}
        <div className="config-panel__section">
          <label className="config-panel__label">Node Name</label>
          <input
            className="config-panel__input"
            type="text"
            value={data.label || ''}
            onChange={(e) => updateLabel(e.target.value)}
            placeholder="Enter node name..."
          />
        </div>

        {/* Type-specific config */}
        {type === 'send_message' && (
          <SendMessageConfig config={config} updateConfig={updateConfig} userCreatedVars={userCreatedVars} />
        )}
        {type === 'ask_question' && (
          <AskQuestionConfig config={config} updateConfig={updateConfig} userCreatedVars={userCreatedVars} />
        )}
        {type === 'condition' && (
          <ConditionConfigPanel config={config} updateConfig={updateConfig} />
        )}

        {/* Delete */}
        <button className="config-panel__delete-node-btn" onClick={() => onDeleteNode(selectedNode.id)}>
          🗑 Delete Node
        </button>
      </div>
    </div>
  );
}

/* ─── Send Message Config ─── */
function SendMessageConfig({ config, updateConfig, userCreatedVars }) {
  const mediaType = config.media_type || 'text';

  const insertVar = (varName) => {
    const current = config.message || '';
    updateConfig('message', `${current} @${varName} `);
  };

  return (
    <>
      <div className="config-panel__section">
        <label className="config-panel__label">Message Type</label>
        <select
          className="config-panel__select"
          value={mediaType}
          onChange={(e) => updateConfig('media_type', e.target.value)}
          style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#1f1f30', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <option value="text">💬 Text Only</option>
          <option value="image">🖼️ Image + Caption</option>
          <option value="audio">🎤 Voice / Audio</option>
        </select>
      </div>

      {(mediaType === 'image' || mediaType === 'audio') && (
        <div className="config-panel__section">
          <label className="config-panel__label">{mediaType === 'image' ? 'Image URL (.jpg / .png)' : 'Audio URL (.mp3 / .ogg)'}</label>
          <input
            className="config-panel__input"
            type="text"
            value={config.media_url || ''}
            onChange={(e) => updateConfig('media_url', e.target.value)}
            placeholder="https://example.com/media.png"
          />
        </div>
      )}

      <div className="config-panel__section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label className="config-panel__label" style={{ margin: 0 }}>{mediaType === 'image' ? 'Caption Text' : 'Message Text'}</label>
          <VariablesPicker onSelect={insertVar} userCreatedVars={userCreatedVars} />
        </div>
        <textarea
          className="config-panel__textarea"
          value={config.message || ''}
          onChange={(e) => updateConfig('message', e.target.value)}
          placeholder="Type message... Click { } Variables to insert @variable"
          rows={4}
        />
      </div>
    </>
  );
}

/* ─── Ask Question Config ─── */
function AskQuestionConfig({ config, updateConfig, userCreatedVars }) {
  const inputType = config.input_type || 'text';
  const options = config.options || [];

  const insertVar = (varName) => {
    const current = config.question || '';
    updateConfig('question', `${current} @${varName} `);
  };

  const addOption = () => {
    const newId = `opt_${Date.now().toString(36)}`;
    const newOptions = [...options, { id: newId, label: '', next_node_id: '' }];
    updateConfig('options', newOptions);
  };

  const updateOption = (index, field, value) => {
    const newOptions = options.map((opt, i) =>
      i === index ? { ...opt, [field]: value } : opt
    );
    updateConfig('options', newOptions);
  };

  const removeOption = (index) => {
    updateConfig('options', options.filter((_, i) => i !== index));
  };

  return (
    <>
      <div className="config-panel__section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label className="config-panel__label" style={{ margin: 0 }}>Question</label>
          <VariablesPicker onSelect={insertVar} userCreatedVars={userCreatedVars} />
        </div>
        <textarea
          className="config-panel__textarea"
          value={config.question || ''}
          onChange={(e) => updateConfig('question', e.target.value)}
          placeholder="What would you like to ask? Click { } Variables"
          rows={3}
        />
      </div>

      <div className="config-panel__section">
        <label className="config-panel__label">Input Type</label>
        <select
          className="config-panel__select"
          value={inputType}
          onChange={(e) => updateConfig('input_type', e.target.value)}
        >
          <option value="text">Free Text</option>
          <option value="buttons">Buttons (max 3)</option>
          <option value="list">List Menu</option>
        </select>
      </div>

      <div className="config-panel__section">
        <label className="config-panel__label">Store Answer In Variable</label>
        <input
          className="config-panel__input"
          type="text"
          value={config.variable_name || ''}
          onChange={(e) => updateConfig('variable_name', e.target.value)}
          placeholder="e.g. issue_type"
        />
      </div>

      {inputType === 'buttons' && (
        <div className="config-panel__section">
          <label className="config-panel__label">Button Options</label>
          <div className="config-panel__options">
            {options.map((opt, idx) => (
              <div key={opt.id || idx} className="config-panel__option-item">
                <span className="config-panel__option-drag">⠿</span>
                <input
                  value={opt.label}
                  onChange={(e) => updateOption(idx, 'label', e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                />
                <button
                  className="config-panel__option-delete"
                  onClick={() => removeOption(idx)}
                >
                  ✕
                </button>
              </div>
            ))}
            {options.length < 3 && (
              <button className="config-panel__add-btn" onClick={addOption}>
                + Add Button
              </button>
            )}
          </div>
        </div>
      )}

      {inputType === 'list' && (
        <ListConfigEditor config={config} updateConfig={updateConfig} />
      )}
    </>
  );
}

/* ─── List Config Editor ─── */
function ListConfigEditor({ config, updateConfig }) {
  const listConfig = config.list_config || { button_text: 'Choose option', sections: [] };
  const sections = listConfig.sections || [];

  const updateListConfig = (newListConfig) => {
    updateConfig('list_config', newListConfig);
  };

  const addSection = () => {
    const newSections = [...sections, { title: '', rows: [{ id: `row_${Date.now().toString(36)}`, label: '', description: '', next_node_id: '' }] }];
    updateListConfig({ ...listConfig, sections: newSections });
  };

  const updateSection = (sIdx, field, value) => {
    const newSections = sections.map((s, i) =>
      i === sIdx ? { ...s, [field]: value } : s
    );
    updateListConfig({ ...listConfig, sections: newSections });
  };

  const addRow = (sIdx) => {
    const newSections = sections.map((s, i) => {
      if (i !== sIdx) return s;
      return { ...s, rows: [...s.rows, { id: `row_${Date.now().toString(36)}`, label: '', description: '', next_node_id: '' }] };
    });
    updateListConfig({ ...listConfig, sections: newSections });
  };

  const updateRow = (sIdx, rIdx, field, value) => {
    const newSections = sections.map((s, si) => {
      if (si !== sIdx) return s;
      return {
        ...s,
        rows: s.rows.map((r, ri) =>
          ri === rIdx ? { ...r, [field]: value } : r
        ),
      };
    });
    updateListConfig({ ...listConfig, sections: newSections });
  };

  const removeRow = (sIdx, rIdx) => {
    const newSections = sections.map((s, si) => {
      if (si !== sIdx) return s;
      return { ...s, rows: s.rows.filter((_, ri) => ri !== rIdx) };
    });
    updateListConfig({ ...listConfig, sections: newSections });
  };

  return (
    <div className="config-panel__section">
      <label className="config-panel__label">List Button Text</label>
      <input
        className="config-panel__input"
        value={listConfig.button_text || ''}
        onChange={(e) => updateListConfig({ ...listConfig, button_text: e.target.value })}
        placeholder="Choose option"
        maxLength={20}
      />

      <label className="config-panel__label" style={{ marginTop: 12 }}>Sections</label>
      {sections.map((section, sIdx) => (
        <div key={sIdx} style={{ marginBottom: 8, padding: 8, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <input
            className="config-panel__input"
            value={section.title}
            onChange={(e) => updateSection(sIdx, 'title', e.target.value)}
            placeholder="Section title"
            style={{ marginBottom: 6 }}
          />
          {section.rows.map((row, rIdx) => (
            <div key={row.id || rIdx} className="config-panel__option-item" style={{ marginBottom: 4 }}>
              <input
                value={row.label}
                onChange={(e) => updateRow(sIdx, rIdx, 'label', e.target.value)}
                placeholder="Row label"
                style={{ flex: 1 }}
              />
              <input
                value={row.description || ''}
                onChange={(e) => updateRow(sIdx, rIdx, 'description', e.target.value)}
                placeholder="Description"
                style={{ flex: 1, fontSize: '0.75rem' }}
              />
              <button className="config-panel__option-delete" onClick={() => removeRow(sIdx, rIdx)}>✕</button>
            </div>
          ))}
          <button className="config-panel__add-btn" onClick={() => addRow(sIdx)} style={{ marginTop: 4 }}>
            + Add Row
          </button>
        </div>
      ))}
      <button className="config-panel__add-btn" onClick={addSection}>
        + Add Section
      </button>
    </div>
  );
}

/* ─── Condition Config ─── */
function ConditionConfigPanel({ config, updateConfig }) {
  const conditions = config.conditions || [];

  const addCondition = () => {
    updateConfig('conditions', [
      ...conditions,
      { variable: '', operator: 'equals', value: '', next_node_id: '' },
    ]);
  };

  const updateCondition = (index, field, value) => {
    const newConditions = conditions.map((c, i) =>
      i === index ? { ...c, [field]: value } : c
    );
    updateConfig('conditions', newConditions);
  };

  const removeCondition = (index) => {
    updateConfig('conditions', conditions.filter((_, i) => i !== index));
  };

  return (
    <>
      <div className="config-panel__section">
        <label className="config-panel__label">Condition Rules</label>
        <div className="config-panel__options">
          {conditions.map((cond, idx) => (
            <div key={idx} className="config-panel__condition-rule">
              <div className="config-panel__condition-row">
                <input
                  value={cond.variable}
                  onChange={(e) => updateCondition(idx, 'variable', e.target.value)}
                  placeholder="Variable name"
                />
                <select
                  value={cond.operator}
                  onChange={(e) => updateCondition(idx, 'operator', e.target.value)}
                >
                  <option value="equals">equals</option>
                  <option value="not_equals">not equals</option>
                </select>
                <input
                  value={cond.value}
                  onChange={(e) => updateCondition(idx, 'value', e.target.value)}
                  placeholder="Value"
                />
                <button className="config-panel__option-delete" onClick={() => removeCondition(idx)}>✕</button>
              </div>
            </div>
          ))}
          <button className="config-panel__add-btn" onClick={addCondition}>
            + Add Condition Rule
          </button>
        </div>
      </div>

      <div className="config-panel__section">
        <label className="config-panel__label">Default (Else) Next Node</label>
        <input
          className="config-panel__input"
          value={config.default_next_node_id || ''}
          onChange={(e) => updateConfig('default_next_node_id', e.target.value)}
          placeholder="Connected via edge on canvas"
          disabled
        />
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Connect the "default" handle on the canvas to set this.
        </span>
      </div>
    </>
  );
}
