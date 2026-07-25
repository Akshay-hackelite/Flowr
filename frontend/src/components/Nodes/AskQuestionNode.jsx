import { Handle, Position } from '@xyflow/react';
import './NodeStyles.css';

export default function AskQuestionNode({ data, selected }) {
  const config = data?.config || {};
  const question = config.question || '';
  const inputType = config.input_type || 'text';
  const variableName = config.variable_name || '';
  const options = config.options || [];
  const listConfig = config.list_config;

  // Collect all option labels for display
  let optionLabels = [];
  if (inputType === 'buttons') {
    optionLabels = options.map((o) => o.label);
  } else if (inputType === 'list' && listConfig) {
    (listConfig.sections || []).forEach((section) => {
      (section.rows || []).forEach((row) => {
        optionLabels.push(row.label);
      });
    });
  }

  // Collect all option IDs for handles
  let optionHandles = [];
  if (inputType === 'buttons') {
    optionHandles = options.map((o) => ({ id: o.id, label: o.label }));
  } else if (inputType === 'list' && listConfig) {
    (listConfig.sections || []).forEach((section) => {
      (section.rows || []).forEach((row) => {
        optionHandles.push({ id: row.id, label: row.label });
      });
    });
  }

  return (
    <div className={`custom-node custom-node--ask_question ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} id="target" />

      <div className="custom-node__header">
        <div className="custom-node__icon">❓</div>
        <div className="custom-node__title">{data.label || 'Ask Question'}</div>
        <div className="custom-node__type-badge">
          {inputType === 'buttons' ? 'Buttons' : inputType === 'list' ? 'List' : 'Text'}
        </div>
      </div>

      <div className="custom-node__body">
        {question ? (
          <div className="custom-node__preview">{question}</div>
        ) : (
          <div className="custom-node__preview custom-node__preview--empty">
            Click to configure question...
          </div>
        )}

        {inputType === 'buttons' && optionHandles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
            {optionHandles.map((opt) => (
              <div key={opt.id} style={{ position: 'relative', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '6px', borderRadius: '4px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {opt.label}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`option_${opt.id}`}
                  style={{ top: '50%', right: '-15px', transform: 'translateY(-50%)', background: 'var(--accent-primary)', width: '10px', height: '10px' }}
                />
              </div>
            ))}
            <div style={{ position: 'relative', background: 'rgba(239, 68, 68, 0.05)', border: '1px dashed var(--error-color)', color: 'var(--error-color)', padding: '6px', borderRadius: '4px', textAlign: 'center', fontSize: '0.8rem' }}>
              Default Fallback <span style={{ color: 'red' }}>*</span>
              <Handle
                type="source"
                position={Position.Right}
                id="default"
                style={{ top: '50%', right: '-15px', transform: 'translateY(-50%)', background: 'var(--error-color)', width: '10px', height: '10px' }}
              />
            </div>
          </div>
        )}

        {inputType === 'list' && listConfig && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            <div style={{ background: '#53bdeb', color: '#fff', padding: '6px', borderRadius: '4px', textAlign: 'center', fontWeight: '600', fontSize: '0.85rem' }}>
              ≡ {listConfig.button_text || 'Menu'}
            </div>
            
            {(listConfig.sections || []).map((section, sIdx) => (
              <div key={sIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {section.title && (
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px', paddingLeft: '4px' }}>
                    {section.title}
                  </div>
                )}
                {(section.rows || []).map((row) => (
                  <div key={row.id} style={{ position: 'relative', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '6px 8px', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{row.label}</span>
                    {row.description && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>{row.description}</span>
                    )}
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={`option_${row.id}`}
                      style={{ top: '50%', right: '-15px', transform: 'translateY(-50%)', background: 'var(--accent-primary)', width: '10px', height: '10px' }}
                    />
                  </div>
                ))}
              </div>
            ))}
            
            <div style={{ position: 'relative', background: 'rgba(239, 68, 68, 0.05)', border: '1px dashed var(--error-color)', color: 'var(--error-color)', padding: '6px', borderRadius: '4px', textAlign: 'center', fontSize: '0.8rem', marginTop: '4px' }}>
              Default Fallback <span style={{ color: 'red' }}>*</span>
              <Handle
                type="source"
                position={Position.Right}
                id="default"
                style={{ top: '50%', right: '-15px', transform: 'translateY(-50%)', background: 'var(--error-color)', width: '10px', height: '10px' }}
              />
            </div>
          </div>
        )}
      </div>

      {variableName && (
        <div className="custom-node__footer">
          <span className="custom-node__var-badge">→ {variableName}</span>
        </div>
      )}

      {/* Output handle for text input */}
      {inputType === 'text' && (
        <Handle type="source" position={Position.Bottom} id="default" />
      )}
    </div>
  );
}
