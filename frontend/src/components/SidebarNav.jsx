import { useState } from 'react';

export default function SidebarNav({ currentHash = '#/', authUser, onLogout }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { label: 'Workflows', hash: '#/', icon: '🌊' },
    { label: 'Live Inbox', hash: '#/inbox', icon: '💬' },
    { label: 'All Executions', hash: '#/executions', icon: '⚡' },
    { label: 'Trigger Rules', hash: '#/trigger-rules', icon: '🎯' },
  ];

  const activeHash = currentHash.split('?')[0] || '#/';

  return (
    <aside style={{
      width: isCollapsed ? '68px' : '240px',
      backgroundColor: '#0f0f1a',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.25s ease',
      position: 'relative',
      height: '100vh',
      flexShrink: 0,
      userSelect: 'none',
      zIndex: 100
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '20px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
      }}>
        <a href="#/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: 'bold', color: '#fff'
          }}>
            🌊
          </div>
          {!isCollapsed && (
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
              Flowr
            </span>
          )}
        </a>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#aaa', borderRadius: '6px', width: '28px', height: '28px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: '12px'
          }}
        >
          {isCollapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Navigation Links */}
      <nav style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {navItems.map((item) => {
          const isActive = activeHash === item.hash || (item.hash !== '#/' && activeHash.startsWith(item.hash));
          return (
            <a
              key={item.hash}
              href={item.hash}
              title={isCollapsed ? item.label : ''}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: isCollapsed ? '12px 0' : '12px 14px',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                borderRadius: '10px', textDecoration: 'none',
                color: isActive ? '#fff' : '#a0a0b8',
                backgroundColor: isActive ? 'rgba(108, 92, 231, 0.2)' : 'transparent',
                border: isActive ? '1px solid rgba(108, 92, 231, 0.4)' : '1px solid transparent',
                fontWeight: isActive ? '600' : '500',
                fontSize: '14px', transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              {!isCollapsed && <span>{item.label}</span>}
            </a>
          );
        })}
      </nav>

      {/* Auth User Footer */}
      <div style={{
        padding: '16px 12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex', flexDirection: 'column', gap: '8px'
      }}>
        {/* User info */}
        <div
          title={isCollapsed ? (authUser?.name || 'User') : ''}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: isCollapsed ? '10px 0' : '10px 12px',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
          }}
        >
          <span style={{ fontSize: '18px' }}>👤</span>
          {!isCollapsed && (
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              <div style={{ fontWeight: '600', color: '#fff', fontSize: '13px' }}>
                {authUser?.name ? authUser.name.split(' ')[0] : 'User'}
              </div>
              <div style={{ fontSize: '11px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {authUser?.email || ''}
              </div>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          title={isCollapsed ? 'Sign Out' : ''}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: isCollapsed ? '8px 0' : '8px 12px',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            background: 'rgba(255, 87, 34, 0.08)', border: '1px solid rgba(255, 87, 34, 0.2)',
            borderRadius: '8px', color: '#ff8a65', cursor: 'pointer', fontSize: '13px', width: '100%'
          }}
        >
          <span style={{ fontSize: '15px' }}>🚪</span>
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
