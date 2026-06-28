import { Handle, Position } from '@xyflow/react';
import './NodeStyles.css';

export default function ConditionNode({ data, selected }) {
  const config = data?.config || {};
  const conditions = config.conditions || [];
  const defaultNextNodeId = config.default_next_node_id;

  return (
    <div className={`custom-node custom-node--condition ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} id="target" />

      <div className="custom-node__header">
        <div className="custom-node__icon">🔀</div>
        <div className="custom-node__title">{data.label || 'Condition'}</div>
        <div className="custom-node__type-badge">Branch</div>
      </div>

      <div className="custom-node__body">
        {conditions.length > 0 ? (
          <div className="custom-node__conditions">
            {conditions.map((cond, i) => (
              <div key={i} className="custom-node__condition-row">
                <span style={{ color: 'var(--accent-amber)' }}>IF</span>
                <span>{cond.variable || '?'}</span>
                <span style={{ color: 'var(--text-muted)' }}>{cond.operator}</span>
                <span>"{cond.value || '?'}"</span>
              </div>
            ))}
            {defaultNextNodeId && (
              <div className="custom-node__condition-row">
                <span style={{ color: 'var(--text-muted)' }}>ELSE →</span>
                <span>Default</span>
              </div>
            )}
          </div>
        ) : (
          <div className="custom-node__preview custom-node__preview--empty">
            Click to add conditions...
          </div>
        )}
      </div>

      {/* One handle per condition + one for default */}
      {conditions.map((_, idx) => (
        <Handle
          key={`cond_${idx}`}
          type="source"
          position={Position.Bottom}
          id={`condition_${idx}`}
          style={{
            left: `${((idx + 1) / (conditions.length + 2)) * 100}%`,
          }}
        />
      ))}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        style={{
          left: `${((conditions.length + 1) / (conditions.length + 2)) * 100}%`,
          background: 'var(--text-muted)',
        }}
      />
    </div>
  );
}
