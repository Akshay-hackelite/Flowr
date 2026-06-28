import { Handle, Position } from '@xyflow/react';
import './NodeStyles.css';

export default function StartNode({ data }) {
  return (
    <div className="start-node">
      <span>⚡</span>
      <span>Start</span>
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
      />
    </div>
  );
}
