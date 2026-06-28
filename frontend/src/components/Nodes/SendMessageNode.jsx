import { Handle, Position } from '@xyflow/react';
import './NodeStyles.css';

export default function SendMessageNode({ data, selected }) {
  const message = data?.config?.message || '';

  return (
    <div className={`custom-node custom-node--send_message ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} id="target" />

      <div className="custom-node__header">
        <div className="custom-node__icon">💬</div>
        <div className="custom-node__title">{data.label || 'Send Message'}</div>
        <div className="custom-node__type-badge">Message</div>
      </div>

      <div className="custom-node__body">
        {message ? (
          <div className="custom-node__preview">{message}</div>
        ) : (
          <div className="custom-node__preview custom-node__preview--empty">
            Click to configure message...
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} id="default" />
    </div>
  );
}
