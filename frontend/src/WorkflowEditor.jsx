import { useState, useCallback, useEffect } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';
import Topbar from './components/Topbar/Topbar';
import Sidebar from './components/Sidebar/Sidebar';
import WorkflowCanvas from './components/Canvas/WorkflowCanvas';
import ConfigPanel from './components/ConfigPanel/ConfigPanel';
import WorkflowRunsViewer from './components/Runs/WorkflowRunsViewer';
import { fetchWorkflow, saveCanvas, updateWorkflow, publishWorkflowBackend, unpublishWorkflowBackend } from './api/client';
import { backendToReactFlow } from './utils/serializer';
import { showToast } from './components/common/Toast';

export default function WorkflowEditor({ workflowId, onBack, initialShowRuns = false, userId }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflowData, setWorkflowData] = useState(null);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowStatus, setWorkflowStatus] = useState('draft');
  const [selectedNode, setSelectedNode] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | 'error'
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showRuns, setShowRuns] = useState(initialShowRuns);

  // Load workflow from backend
  useEffect(() => {
    const loadWorkflow = async () => {
      try {
        setLoading(true);
        const data = await fetchWorkflow(workflowId);
        setWorkflowData(data.workflow);
        setWorkflowName(data.workflow.name);
        setWorkflowStatus(data.workflow.status);

        // Convert backend nodes to React Flow format
        const { nodes: rfNodes, edges: rfEdges } = backendToReactFlow(data.workflow, data.nodes);
        setNodes(rfNodes);
        setEdges(rfEdges);
      } catch (err) {
        console.error('Failed to load workflow:', err);
        showToast('Failed to load workflow', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadWorkflow();
  }, [workflowId, setNodes, setEdges]);

  // Handle node selection
  const handleNodeSelect = useCallback((node) => {
    setSelectedNode(node);
  }, []);

  // Update node data (from config panel)
  const handleUpdateNode = useCallback((nodeId, newData) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return { ...n, data: newData };
        }
        return n;
      })
    );
    // Also update selectedNode so the config panel reflects changes
    setSelectedNode((prev) => {
      if (prev && prev.id === nodeId) {
        return { ...prev, data: newData };
      }
      return prev;
    });
  }, [setNodes]);

  // Delete node
  const handleDeleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  }, [setNodes, setEdges]);

  // Save canvas to backend
  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      setSaveStatus('saving');

      // Find first node (the one connected to the start node)
      const startEdge = edges.find((e) => e.source === 'start');
      const firstNodeId = startEdge?.target || null;

      // Prepare nodes for backend (exclude start node)
      const canvasNodes = nodes
        .filter((n) => n.type !== 'start')
        .map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        }));

      const canvasEdges = edges
        .filter((e) => e.source !== 'start') // Keep non-start edges
        .map((e) => ({
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle || null,
        }));

      // Also add start edge if it exists, but source is the first backend node
      // (The backend doesn't know about the "start" concept — it uses first_node_id)

      await saveCanvas(workflowId, {
        nodes: canvasNodes,
        edges: canvasEdges,
        firstNodeId: firstNodeId,
        userId: userId || 'user_unknown',
      });

      // Also save name if changed
      if (workflowData && workflowName !== workflowData.name) {
        await updateWorkflow(workflowId, {
          name: workflowName,
          updated_by_user_id: userId || 'user_unknown',
        });
      }

      setSaveStatus('saved');
      showToast('Workflow saved successfully!', 'success');

      setTimeout(() => setSaveStatus(null), 2500);
    } catch (err) {
      console.error('Failed to save:', err);
      setSaveStatus('error');
      showToast('Failed to save: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, workflowId, workflowName, workflowData]);

  // Publish workflow
  const handlePublish = useCallback(async () => {
    try {
      // Save first
      await handleSave();

      await publishWorkflowBackend(workflowId);
      setWorkflowStatus('published');
      showToast('Workflow published! 🚀', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [handleSave, workflowId]);

  // Unpublish workflow
  const handleUnpublish = useCallback(async () => {
    try {
      await unpublishWorkflowBackend(workflowId);
      setWorkflowStatus('draft');
      showToast('Workflow unpublished', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [workflowId]);

  // Close config panel
  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-tertiary)',
        flexDirection: 'column',
        gap: 12,
      }}>
        <div style={{
          width: 32, height: 32,
          border: '3px solid var(--border-default)',
          borderTopColor: 'var(--accent-primary)',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }} />
        Loading workflow...
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <Topbar
        workflowName={workflowName}
        workflowStatus={workflowStatus}
        onNameChange={setWorkflowName}
        onSave={handleSave}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        onBack={onBack}
        onOpenRuns={() => setShowRuns(true)}
        saveStatus={saveStatus}
        isSaving={isSaving}
      />

      <Sidebar />

      <WorkflowCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        setNodes={setNodes}
        setEdges={setEdges}
        onNodeSelect={handleNodeSelect}
        selectedNodeId={selectedNode?.id}
        showPanel={!!selectedNode}
      />

      {selectedNode && (
        <ConfigPanel
          selectedNode={selectedNode}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onClose={handleClosePanel}
          nodes={nodes}
          edges={edges}
        />
      )}

      {showRuns && (
        <WorkflowRunsViewer
          workflowId={workflowId}
          onClose={() => setShowRuns(false)}
        />
      )}
    </div>
  );
}
