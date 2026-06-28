import { useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import WorkflowList from './components/WorkflowList/WorkflowList';
import WorkflowEditor from './WorkflowEditor';
import Inbox from './components/Inbox/Inbox';
import AllExecutionsTab from './components/AllExecutionsTab';
import TriggerRulesPage from './components/TriggerRulesPage';
import SidebarNav from './components/SidebarNav';
import LoginModal from './components/LoginModal';
import ToastContainer from './components/common/Toast';
import { fetchWorkflows } from './api/client';
import './index.css';

const AUTH_KEY = 'flowr_auth';

function loadStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAuth(data) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(data));
}

function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

export default function App() {
  const [currentHash, setCurrentHash] = useState(window.location.hash || '#/');
  const [currentWorkflowId, setCurrentWorkflowId] = useState(null);
  const [view, setView] = useState('list');
  const [initialShowRuns, setInitialShowRuns] = useState(false);

  // Auth state — null means not logged in (forced login screen)
  const [authData, setAuthData] = useState(() => loadStoredAuth());
  const [workflows, setWorkflows] = useState([]);

  const clientId = authData?.client?.id || null;
  const whatsappAccountId = authData?.whatsapp_account?.id || null;
  const userId = authData?.user?.id || null;
  const authUser = authData?.user || null;

  const loadWorkflows = async (cid = clientId) => {
    if (!cid) return;
    try {
      const data = await fetchWorkflows(cid);
      setWorkflows(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (clientId) loadWorkflows(clientId);
  }, [view, clientId]);

  // Handle Hash Routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '#/';
      setCurrentHash(hash);

      if (hash === '#/inbox') {
        setView('inbox');
        setCurrentWorkflowId(null);
      } else if (hash === '#/executions') {
        loadWorkflows();
        setView('all_executions');
        setCurrentWorkflowId(null);
      } else if (hash === '#/trigger-rules') {
        loadWorkflows();
        setView('trigger_rules');
        setCurrentWorkflowId(null);
      } else if (hash.startsWith('#/workflow/')) {
        const parts = hash.split('/');
        const wfId = decodeURIComponent(parts[2] || '');
        const showRuns = parts[3] === 'runs';
        if (wfId) {
          setCurrentWorkflowId(wfId);
          setInitialShowRuns(showRuns);
          setView('editor');
        }
      } else {
        setView('list');
        setCurrentWorkflowId(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleAuthSuccess = (data) => {
    const normalised = {
      user: data.user,
      client: data.client,
      whatsapp_account: data.whatsapp_account,
      token: data.token,
    };
    saveAuth(normalised);
    setAuthData(normalised);
  };

  const handleLogout = () => {
    clearAuth();
    setAuthData(null);
    setWorkflows([]);
    window.location.hash = '#/';
  };

  const handleSelectWorkflow = (workflowId) => {
    window.location.hash = `#/workflow/${encodeURIComponent(workflowId)}`;
  };

  const handleOpenWorkflowExecutions = (workflowId) => {
    window.location.hash = `#/workflow/${encodeURIComponent(workflowId)}/runs`;
  };

  const handleOpenInbox = () => { window.location.hash = '#/inbox'; };
  const handleOpenAllExecutions = () => { window.location.hash = '#/executions'; };
  const handleBackToList = () => { window.location.hash = '#/'; };

  // ── If not authenticated, show ONLY the login modal (full-screen) ──────────
  if (!authData) {
    return (
      <>
        {/* Full-screen dark backdrop */}
        <div style={{
          height: '100vh', width: '100vw', backgroundColor: '#0a0a12',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: '24px',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '16px',
              background: 'linear-gradient(135deg, #ff6b6b, #4ecdc4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px auto', fontSize: '32px',
            }}>🌊</div>
            <h1 style={{ color: '#fff', fontSize: '28px', margin: '0 0 8px 0', fontWeight: 700 }}>Flowr</h1>
            <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>Sign in to access your WhatsApp automation workspace</p>
          </div>
        </div>
        <LoginModal
          isOpen={true}
          onClose={() => {}} // cannot close without logging in
          canClose={false}
          onAuthSuccess={handleAuthSuccess}
        />
        <ToastContainer />
      </>
    );
  }

  // ── Authenticated UI ────────────────────────────────────────────────────────
  return (
    <>
      {view === 'editor' && currentWorkflowId ? (
        <ReactFlowProvider>
          <WorkflowEditor
            workflowId={currentWorkflowId}
            onBack={handleBackToList}
            initialShowRuns={initialShowRuns}
            userId={userId}
          />
        </ReactFlowProvider>
      ) : (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#0a0a12', overflow: 'hidden' }}>
          <SidebarNav
            currentHash={currentHash}
            authUser={authUser}
            onLogout={handleLogout}
          />
          <main style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
            {view === 'inbox' && (
              <Inbox onBack={handleBackToList} clientId={clientId} />
            )}

            {view === 'all_executions' && (
              <div style={{ backgroundColor: '#0a0a12', minHeight: '100%' }}>
                <div style={{ padding: '16px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center' }}>
                  <a href="#/" style={{ textDecoration: 'none', background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    ← Back to Workflows
                  </a>
                </div>
                <AllExecutionsTab
                  clientId={clientId}
                  workflows={workflows}
                  onOpenWorkflowExecutions={handleOpenWorkflowExecutions}
                />
              </div>
            )}

            {view === 'trigger_rules' && (
              <TriggerRulesPage
                clientId={clientId}
                workflows={workflows}
              />
            )}

            {view === 'list' && (
              <WorkflowList
                onSelectWorkflow={handleSelectWorkflow}
                onOpenInbox={handleOpenInbox}
                onOpenAllExecutions={handleOpenAllExecutions}
                onOpenTriggerRules={() => { window.location.hash = '#/trigger-rules'; }}
                authUser={authUser}
                clientId={clientId}
                whatsappAccountId={whatsappAccountId}
                userId={userId}
                onOpenWorkflowExecutions={handleOpenWorkflowExecutions}
                onLogout={handleLogout}
              />
            )}
          </main>
        </div>
      )}

      <ToastContainer />
    </>
  );
}
