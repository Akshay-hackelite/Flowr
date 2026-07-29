const API_BASE = 'http://localhost:8000';

export async function fetchWorkflows(clientId) {
  const res = await fetch(`${API_BASE}/api/workflows?client_id=${encodeURIComponent(clientId)}`);
  if (!res.ok) throw new Error('Failed to fetch workflows');
  const data = await res.json();
  return data.workflows;
}

export async function fetchWorkflow(workflowId) {
  const res = await fetch(`${API_BASE}/api/workflows/${encodeURIComponent(workflowId)}`);
  if (!res.ok) throw new Error('Failed to fetch workflow');
  return await res.json();
}

export async function createWorkflow({ clientId, whatsappAccountId, userId, name, description }) {
  const res = await fetch(`${API_BASE}/api/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      whatsapp_account_id: whatsappAccountId,
      created_by_user_id: userId,
      name,
      description,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to create workflow');
  }
  return await res.json();
}

export async function updateWorkflow(workflowId, updates) {
  const res = await fetch(`${API_BASE}/api/workflows/${encodeURIComponent(workflowId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to update workflow');
  }
  return await res.json();
}

export async function deleteWorkflow(workflowId) {
  const res = await fetch(`${API_BASE}/api/workflows/${encodeURIComponent(workflowId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete workflow');
  return await res.json();
}

export async function saveCanvas(workflowId, { nodes, edges, firstNodeId, userId }) {
  const res = await fetch(`${API_BASE}/api/workflows/${encodeURIComponent(workflowId)}/save-canvas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nodes,
      edges,
      first_node_id: firstNodeId,
      updated_by_user_id: userId,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to save canvas');
  }
  return await res.json();
}

export async function fetchWorkflowRuns(workflowId, limit = 50) {
  const res = await fetch(`${API_BASE}/api/workflows/${encodeURIComponent(workflowId)}/runs?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch runs');
  const data = await res.json();
  return data.runs;
}

export async function fetchClientMessages(clientId, limit = 0) {
  const res = await fetch(`${API_BASE}/api/messages?client_id=${encodeURIComponent(clientId)}&limit=${limit}&t=${Date.now()}`);
  if (!res.ok) throw new Error('Failed to fetch client messages');
  const data = await res.json();
  return data.messages;
}

export async function fetchClientContacts(clientId) {
  const res = await fetch(`${API_BASE}/api/contacts?client_id=${encodeURIComponent(clientId)}`);
  if (!res.ok) throw new Error('Failed to fetch client contacts');
  const data = await res.json();
  return data.contacts;
}

export async function fetchClientConversationMetadata(clientId) {
  const res = await fetch(`${API_BASE}/api/conversations/metadata?client_id=${encodeURIComponent(clientId)}&t=${Date.now()}`);
  if (!res.ok) throw new Error('Failed to fetch conversation metadata');
  const data = await res.json();
  return data.metadata;
}

export async function fetchContactChatStatus(clientId, contactPhone) {
  const res = await fetch(`${API_BASE}/api/contacts/${encodeURIComponent(contactPhone)}/inbox/status?client_id=${encodeURIComponent(clientId)}&t=${Date.now()}`);
  if (!res.ok) throw new Error('Failed to fetch contact status');
  const data = await res.json();
  return data.status;
}

export async function updateContactChatStatus(clientId, contactPhone, status) {
  const res = await fetch(`${API_BASE}/api/contacts/${encodeURIComponent(contactPhone)}/inbox/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, status }),
  });
  if (!res.ok) throw new Error('Failed to update contact status');
  return await res.json();
}

export async function fetchRunDebugData(workflowRunId) {
  const res = await fetch(`${API_BASE}/runs/debug?workflow_run_id=${encodeURIComponent(workflowRunId)}`);
  if (!res.ok) throw new Error('Failed to fetch debug data');
  return await res.json();
}

export async function loginUser({ email, password }) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Login failed');
  }
  return await res.json();
}

export async function signupUser({ client_name, user_name, email, password, phone_number_id, whatsapp_business_account_id }) {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name, user_name, email, password, phone_number_id, whatsapp_business_account_id }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Signup failed');
  }
  return await res.json();
}

export async function googleAuthUser({ email, name, client_name, phone_number_id, whatsapp_business_account_id }) {
  const res = await fetch(`${API_BASE}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, client_name, phone_number_id, whatsapp_business_account_id }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Google auth failed');
  }
  return await res.json();
}

export async function fetchAllRuns(clientId, limit = 100) {
  const res = await fetch(`${API_BASE}/api/runs?client_id=${encodeURIComponent(clientId)}&limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch all runs');
  const data = await res.json();
  return data.runs;
}

export async function setWorkflowDefault(workflowId) {
  const res = await fetch(`${API_BASE}/api/workflows/${encodeURIComponent(workflowId)}/set-default`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to set default workflow');
  }
  return await res.json();
}

export async function sendHumanReply({ clientId, contactPhone, text }) {
  const res = await fetch(`${API_BASE}/api/messages/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, contact_phone: contactPhone, text }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to send reply');
  }
  return await res.json();
}
