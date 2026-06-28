import { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import StartNode from '../Nodes/StartNode';
import SendMessageNode from '../Nodes/SendMessageNode';
import AskQuestionNode from '../Nodes/AskQuestionNode';
import ConditionNode from '../Nodes/ConditionNode';
import DeletableEdge from './DeletableEdge';
import { DEFAULT_CONFIGS, NODE_COLORS } from '../../constants';
import { generateNodeId } from '../../utils/serializer';
import './WorkflowCanvas.css';

const nodeTypes = {
  start: StartNode,
  send_message: SendMessageNode,
  ask_question: AskQuestionNode,
  condition: ConditionNode,
};

const edgeTypes = {
  deletable: DeletableEdge,
  smoothstep: DeletableEdge,
};

const defaultEdgeOptions = {
  type: 'deletable',
  animated: true,
  style: { strokeWidth: 2, stroke: '#4ecdc4' },
};

export default function WorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  setNodes,
  setEdges,
  onNodeSelect,
  selectedNodeId,
  showPanel,
}) {
  const reactFlowWrapper = useRef(null);
  const { screenToFlowPosition } = useReactFlow();

  const onConnect = useCallback(
    (params) => {
      const strokeColor = '#4ecdc4';

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            sourceHandle: params.sourceHandle || 'default',
            targetHandle: params.targetHandle || 'target',
            type: 'deletable',
            animated: true,
            style: { strokeWidth: 2, stroke: strokeColor },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const onNodeClick = useCallback(
    (event, node) => {
      if (node.type !== 'start') {
        onNodeSelect(node);
      }
    },
    [onNodeSelect]
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData('application/reactflow');
      if (!nodeType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNodeId = generateNodeId();
      const nodeColor = NODE_COLORS[nodeType];
      const defaultConfig = { ...(DEFAULT_CONFIGS[nodeType] || {}) };

      // Deep clone options for ask_question
      if (nodeType === 'ask_question' && defaultConfig.options) {
        defaultConfig.options = defaultConfig.options.map((opt, idx) => ({
          ...opt,
          id: `opt_${Date.now().toString(36)}_${idx}`,
        }));
      }

      const newNode = {
        id: newNodeId,
        type: nodeType,
        position,
        data: {
          label: nodeColor?.label || nodeType,
          config: defaultConfig,
          nodeType: nodeType,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes]
  );

  const hasOnlyStart = nodes.length <= 1;

  return (
    <div
      ref={reactFlowWrapper}
      className={`canvas-wrapper ${showPanel ? 'canvas-wrapper--with-panel' : ''}`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        deleteKeyCode={['Backspace', 'Delete']}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        /* Increase the "snap zone" when dropping a connection onto a target handle */
        connectionRadius={50}
        /* Show a clean line while dragging to connect */
        connectionLineStyle={{ stroke: '#4ecdc4', strokeWidth: 2, strokeDasharray: '6 3' }}
        nodeDragThreshold={2}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255,255,255,0.05)"
        />
        <Controls />
        <MiniMap
          nodeStrokeColor={(n) => {
            const c = NODE_COLORS[n.type];
            return c ? c.border : 'var(--border-default)';
          }}
          nodeColor={(n) => {
            const c = NODE_COLORS[n.type];
            return c ? c.bg : 'var(--bg-tertiary)';
          }}
          style={{ width: 140, height: 100 }}
        />
      </ReactFlow>

      {hasOnlyStart && (
        <div className="canvas-empty-state">
          <div className="canvas-empty-state__icon">🎨</div>
          <div className="canvas-empty-state__title">Start building your workflow</div>
          <div className="canvas-empty-state__desc">
            Drag nodes from the left sidebar onto the canvas, then connect them by dragging between handles.
          </div>
        </div>
      )}
    </div>
  );
}
