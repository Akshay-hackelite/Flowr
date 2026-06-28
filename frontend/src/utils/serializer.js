/**
 * Converts backend workflow + nodes into React Flow nodes/edges format.
 * Also converts React Flow state back to the format the backend expects.
 */

/**
 * Convert backend nodes into React Flow nodes.
 * Positions are restored from the persisted `position` field if available,
 * otherwise a fallback auto-layout is used.
 */
export function backendToReactFlow(workflow, backendNodes) {
  const rfNodes = [];
  const rfEdges = [];

  if (!backendNodes || backendNodes.length === 0) {
    rfNodes.push({
      id: 'start',
      type: 'start',
      position: { x: 300, y: 50 },
      data: { label: 'Start' },
      deletable: false,
    });
    return { nodes: rfNodes, edges: rfEdges };
  }

  // Map id → node for quick lookup
  const nodeMap = {};
  backendNodes.forEach((n) => { nodeMap[n.id] = n; });

  // ── Determine ordered list (first_node_id chain first, then the rest) ──
  const ordered = [];
  const visited = new Set();
  let currentId = workflow.first_node_id;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const node = nodeMap[currentId];
    if (!node) break;
    ordered.push(node);
    // For linear nodes follow next_node_id; for branching types we still
    // want all reachable nodes, so we'll add the rest below.
    currentId = node.next_node_id;
  }
  backendNodes.forEach((n) => {
    if (!visited.has(n.id)) ordered.push(n);
  });

  // ── Build auto-layout positions as fallback ──
  // Use a simple top-down tree layout so branching workflows look sensible.
  const SPACING_Y = 180;
  const SPACING_X = 260;
  const BASE_X = 400;
  const BASE_Y = 240;

  // Compute depths via BFS from first_node_id
  const depths = {};       // nodeId → depth
  const siblings = {};     // depth → [nodeIds at that depth]
  const queue = workflow.first_node_id ? [{ id: workflow.first_node_id, depth: 0 }] : [];
  const bfsVisited = new Set();
  while (queue.length) {
    const { id, depth } = queue.shift();
    if (bfsVisited.has(id)) continue;
    bfsVisited.add(id);
    depths[id] = depth;
    (siblings[depth] = siblings[depth] || []).push(id);
    const node = nodeMap[id];
    if (!node) continue;

    // Collect all next-node references
    const nexts = [];
    if (node.next_node_id) nexts.push(node.next_node_id);
    if (node.type === 'ask_question' && node.config) {
      const it = node.config.input_type || 'text';
      if (it === 'buttons') {
        (node.config.options || []).forEach((o) => { if (o.next_node_id) nexts.push(o.next_node_id); });
      } else if (it === 'list') {
        ((node.config.list_config || {}).sections || []).forEach((s) =>
          (s.rows || []).forEach((r) => { if (r.next_node_id) nexts.push(r.next_node_id); })
        );
      }
    }
    if (node.type === 'condition' && node.config) {
      (node.config.conditions || []).forEach((c) => { if (c.next_node_id) nexts.push(c.next_node_id); });
      if (node.config.default_next_node_id) nexts.push(node.config.default_next_node_id);
    }

    nexts.forEach((nid) => { if (!bfsVisited.has(nid)) queue.push({ id: nid, depth: depth + 1 }); });
  }

  // Any node not reached by BFS gets stacked at the bottom
  backendNodes.forEach((n) => {
    if (depths[n.id] === undefined) {
      const maxDepth = Object.values(depths).reduce((m, d) => Math.max(m, d), 0);
      const d = maxDepth + 1;
      depths[n.id] = d;
      (siblings[d] = siblings[d] || []).push(n.id);
    }
  });

  function autoPosition(nodeId) {
    const depth = depths[nodeId] ?? 0;
    const sibs = siblings[depth] || [nodeId];
    const idx = sibs.indexOf(nodeId);
    const totalWidth = sibs.length * SPACING_X;
    const x = BASE_X - totalWidth / 2 + idx * SPACING_X;
    const y = BASE_Y + depth * SPACING_Y;
    return { x, y };
  }

  // ── Start node ──
  rfNodes.push({
    id: 'start',
    type: 'start',
    position: { x: BASE_X, y: 50 },
    data: { label: 'Start' },
    deletable: false,
  });

  // ── Convert each backend node → React Flow node ──
  ordered.forEach((node) => {
    // Use saved position if available, otherwise auto-layout
    const position = (node.position && typeof node.position.x === 'number' && typeof node.position.y === 'number')
      ? node.position
      : autoPosition(node.id);

    rfNodes.push({
      id: node.id,
      type: node.type,
      position,
      data: {
        label: node.name,
        backendId: node.id,
        config: node.config || {},
        nodeType: node.type,
      },
    });
  });

  // ── Build edges ──
  // Start → first node
  if (workflow.first_node_id) {
    rfEdges.push({
      id: `start->${workflow.first_node_id}`,
      source: 'start',
      sourceHandle: 'default',
      target: workflow.first_node_id,
      targetHandle: 'target',
      type: 'deletable',
      animated: true,
      style: { stroke: '#4ecdc4', strokeWidth: 2 },
    });
  }

  ordered.forEach((node) => {
    // send_message simple edge
    if (node.type === 'send_message' && node.next_node_id) {
      rfEdges.push({
        id: `${node.id}->${node.next_node_id}`,
        source: node.id,
        sourceHandle: 'default',
        target: node.next_node_id,
        targetHandle: 'target',
        type: 'deletable',
        animated: true,
        style: { stroke: '#4ecdc4', strokeWidth: 2 },
      });
    }

    // ask_question
    if (node.type === 'ask_question' && node.config) {
      const inputType = node.config.input_type || 'text';

      if (inputType === 'text' && node.next_node_id) {
        rfEdges.push({
          id: `${node.id}->${node.next_node_id}`,
          source: node.id,
          sourceHandle: 'default',
          target: node.next_node_id,
          targetHandle: 'target',
          type: 'deletable',
          animated: true,
          style: { stroke: '#4ecdc4', strokeWidth: 2 },
        });
      }

      if (inputType === 'buttons' && node.config.options) {
        node.config.options.forEach((opt) => {
          if (opt.next_node_id) {
            rfEdges.push({
              id: `${node.id}->option_${opt.id}->${opt.next_node_id}`,
              source: node.id,
              sourceHandle: `option_${opt.id}`,
              target: opt.next_node_id,
              targetHandle: 'target',
              type: 'deletable',
              animated: true,
              label: opt.label,
              style: { stroke: '#4ecdc4', strokeWidth: 2 },
            });
          }
        });
      }

      if (inputType === 'list' && node.config.list_config) {
        const sections = node.config.list_config.sections || [];
        sections.forEach((section) => {
          (section.rows || []).forEach((row) => {
            if (row.next_node_id) {
              rfEdges.push({
                id: `${node.id}->option_${row.id}->${row.next_node_id}`,
                source: node.id,
                sourceHandle: `option_${row.id}`,
                target: row.next_node_id,
                targetHandle: 'target',
                type: 'deletable',
                animated: true,
                label: row.label,
                style: { stroke: '#4ecdc4', strokeWidth: 2 },
              });
            }
          });
        });
      }

      if ((inputType === 'buttons' || inputType === 'list') && node.config.default_next_node_id) {
        rfEdges.push({
          id: `${node.id}->default->${node.config.default_next_node_id}`,
          source: node.id,
          sourceHandle: 'default',
          target: node.config.default_next_node_id,
          targetHandle: 'target',
          type: 'deletable',
          animated: true,
          label: 'Fallback',
          style: { stroke: '#4ecdc4', strokeWidth: 2, strokeDasharray: '5,5' },
        });
      }
    }

    // condition
    if (node.type === 'condition' && node.config) {
      (node.config.conditions || []).forEach((cond, idx) => {
        if (cond.next_node_id) {
          rfEdges.push({
            id: `${node.id}->cond_${idx}->${cond.next_node_id}`,
            source: node.id,
            sourceHandle: `condition_${idx}`,
            target: cond.next_node_id,
            targetHandle: 'target',
            type: 'deletable',
            animated: true,
            label: `${cond.variable} ${cond.operator} ${cond.value}`,
            style: { stroke: '#4ecdc4', strokeWidth: 2 },
          });
        }
      });

      if (node.config.default_next_node_id) {
        rfEdges.push({
          id: `${node.id}->default->${node.config.default_next_node_id}`,
          source: node.id,
          sourceHandle: 'default',
          target: node.config.default_next_node_id,
          targetHandle: 'target',
          type: 'deletable',
          animated: true,
          label: 'Default',
          style: { stroke: '#4ecdc4', strokeWidth: 2, strokeDasharray: '5,5' },
        });
      }
    }
  });

  return { nodes: rfNodes, edges: rfEdges };
}

/**
 * Generate a short unique ID for new canvas nodes.
 */
let counter = 0;
export function generateNodeId() {
  counter++;
  return `node_${Date.now().toString(36)}_${counter}`;
}
