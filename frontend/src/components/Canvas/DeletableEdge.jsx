import React, { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow } from '@xyflow/react';

export default function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  selected,
}) {
  const { setEdges } = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = (evt) => {
    evt.stopPropagation();
    setEdges((edges) => edges.filter((e) => e.id !== id));
  };

  const finalStyle = {
    ...style,
    stroke: selected ? 'var(--accent-primary, #4ecdc4)' : style.stroke,
    strokeWidth: selected ? 4 : (style.strokeWidth || 2),
    filter: selected ? 'drop-shadow(0 0 3px rgba(78, 205, 196, 0.6))' : 'none',
  };

  return (
    <>
      <path
        d={edgePath}
        markerEnd={markerEnd}
        style={{ ...finalStyle, pointerEvents: 'none' }}
        className="react-flow__edge-path"
        fill="none"
      />
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        className="react-flow__edge-interaction nodrag nopan"
        style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: 'all',
            zIndex: 1000,
          }}
          className="nodrag nopan"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {label && (
            <div style={{
              background: '#1e1e2e',
              padding: '2px 6px',
              borderRadius: 4,
              color: '#fff',
              fontSize: 11,
              marginBottom: 4,
              border: '1px solid #4ecdc4',
              textAlign: 'center',
            }}>
              {label}
            </div>
          )}
          <button
            onClick={onEdgeClick}
            title="Delete connection"
            style={{
              width: 20,
              height: 20,
              background: '#ff6b6b',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              opacity: (selected || isHovered || label) ? 1 : 0,
              transition: 'opacity 0.2s ease',
              pointerEvents: (selected || isHovered || label) ? 'all' : 'none',
            }}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
