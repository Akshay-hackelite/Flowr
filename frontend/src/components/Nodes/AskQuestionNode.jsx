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

        {optionLabels.length > 0 && (
          <div className="custom-node__options">
            {optionLabels.map((label, i) => (
              <span key={i} className="custom-node__option-pill">{label}</span>
            ))}
          </div>
        )}
      </div>

      {variableName && (
        <div className="custom-node__footer">
          <span className="custom-node__var-badge">→ {variableName}</span>
        </div>
      )}

      {/* Output handles: one per option for buttons/list, one default for text */}
      {inputType === 'text' ? (
        <Handle type="source" position={Position.Bottom} id="default" />
      ) : (
        optionHandles.map((opt, idx) => (
          <Handle
            key={opt.id}
            type="source"
            position={Position.Bottom}
            id={`option_${opt.id}`}
            style={{
              left: `${((idx + 1) / (optionHandles.length + 1)) * 100}%`,
            }}
          />
        ))
      )}
    </div>
  );
}
