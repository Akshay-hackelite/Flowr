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

  return (
    <>
      <g
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <path
          d={edgePath}
          fill="none"
          strokeOpacity={0}
          strokeWidth={20}
          style={{ cursor: 'pointer' }}
        />
        <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      </g>
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
              opacity: isHovered || label ? 1 : 0,
              transition: 'opacity 0.2s ease',
            }}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
