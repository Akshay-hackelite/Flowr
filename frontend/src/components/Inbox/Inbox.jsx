import { useState, useEffect } from 'react';
import { fetchClientMessages, sendHumanReply, fetchContactChatStatus, updateContactChatStatus, fetchClientConversationMetadata } from '../../api/client';
import './Inbox.css';

export default function Inbox({ onBack, clientId }) {
  const [messages, setMessages] = useState([]);
  const [conversationMetadata, setConversationMetadata] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactStatusMap, setContactStatusMap] = useState({});
  const [isLiveSync, setIsLiveSync] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  const loadStatusForContact = async (phone) => {
    if (!phone) return;
    try {
      const status = await fetchContactChatStatus(clientId, phone);
      setContactStatusMap(prev => {
        if (prev[phone] !== status) {
          return { ...prev, [phone]: status };
        }
        return prev;
      });
    } catch (err) {
      console.error('Failed to fetch contact status:', err);
    }
  };

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [messagesData, metaData] = await Promise.all([
        fetchClientMessages(clientId, 0),
        fetchClientConversationMetadata(clientId).catch(() => []) // fail gracefully if not ready
      ]);
      setMessages(messagesData || []);
      setConversationMetadata(metaData || []);

      // Auto-select first contact if none selected
      if (!selectedContact && messagesData && messagesData.length > 0) {
        const firstPhone = messagesData[0].contact_phone;
        setSelectedContact(firstPhone);
      } else if (selectedContact && !silent) {
        // If not silent (or maybe even if silent), we want to update the status.
        // Actually, we want to update the status during polling too.
        loadStatusForContact(selectedContact);
      }
    } catch (err) {
      console.error('Failed to load live inbox data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    if (selectedContact) {
      loadStatusForContact(selectedContact);
    }
  }, [selectedContact]);

  useEffect(() => {
    if (!isLiveSync) return;
    const interval = setInterval(() => {
      loadMessages(true);
      if (selectedContact) {
        loadStatusForContact(selectedContact);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [isLiveSync, selectedContact]);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedContact || replyLoading) return;
    setReplyLoading(true);
    try {
      await sendHumanReply({
        clientId,
        contactPhone: selectedContact,
        text: replyText.trim(),
      });
      setReplyText('');
      await loadMessages(true);
    } catch (err) {
      alert(err.message || 'Failed to send reply');
    } finally {
      setReplyLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedContact) return;
    try {
      await updateContactChatStatus(clientId, selectedContact, newStatus);
      setContactStatusMap(prev => ({ ...prev, [selectedContact]: newStatus }));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Group messages by contact_phone
  const contactsMap = {};
  messages.forEach((msg) => {
    const phone = msg.contact_phone || 'Unknown';
    if (!contactsMap[phone]) {
      contactsMap[phone] = [];
    }
    contactsMap[phone].push(msg);
  });

  const contactsList = Object.keys(contactsMap);
  const activeMessages = selectedContact ? (contactsMap[selectedContact] || []) : [];
  // Sort chronologically ascending for chat display
  const sortedChat = [...activeMessages].sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return timeA - timeB;
  });

  const resolveMessageLabel = (text, allMessages = []) => {
    if (!text) return '[Non-text message / Interactive]';
    if (text.startsWith('opt_') || text.startsWith('row_') || text.startsWith('sec_')) {
      for (const msg of allMessages) {
        const options = msg?.metadata?.options || [];
        const found = options.find(o => o.id === text);
        if (found && found.label) return found.label;
        if (found && found.title) return found.title;
      }
    }
    return text;
  };

  const renderMessageContent = (msg, allMessages = []) => {
    const text = resolveMessageLabel(msg.text, allMessages);
    
    const isButtons = msg.metadata?.input_type === 'buttons' || (msg.metadata?.options && Array.isArray(msg.metadata.options));
    const isList = msg.metadata?.input_type === 'list' || msg.metadata?.list_config;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <div style={{ paddingBottom: (isButtons || isList) ? '6px' : '0' }}>{text}</div>
        
        {isButtons && msg.metadata?.options && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '6px' }}>
            {msg.metadata.options.map((opt, i) => (
              <div key={i} style={{ 
                color: '#53bdeb', 
                textAlign: 'center', 
                padding: '8px 0',
                borderBottom: i < msg.metadata.options.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                fontWeight: 500,
                fontSize: '0.95rem',
                cursor: 'default'
              }}>
                {opt.label || opt.title}
              </div>
            ))}
          </div>
        )}

        {isList && msg.metadata?.list_config && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '6px' }}>
            <div style={{ 
              color: '#53bdeb', 
              textAlign: 'center', 
              padding: '8px 0',
              fontWeight: 500,
              fontSize: '0.95rem',
              cursor: 'default'
            }}>
              ≡ {msg.metadata.list_config.button_text || 'Menu'}
            </div>
          </div>
        )}
      </div>
    );
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const renderStatusIcon = (status) => {
    const st = (status || '').toLowerCase();
    if (st === 'sent') return <span title="Sent" style={{ color: '#8696a0', fontWeight: 600, marginLeft: '6px' }}>✓</span>;
    if (st === 'delivered') return <span title="Delivered" style={{ color: '#8696a0', fontWeight: 600, marginLeft: '6px' }}>✓✓</span>;
    if (st === 'read') return <span title="Read" style={{ color: '#53bdeb', fontWeight: 600, marginLeft: '6px' }}>✓✓</span>;
    if (st === 'failed') return <span title="Failed to send" style={{ color: 'var(--accent-red)', fontWeight: 600, marginLeft: '6px' }}>❗</span>;
    return <span style={{ fontSize: '11px', color: '#8696a0', marginLeft: '6px' }}>({status})</span>;
  };


  return (
    <div className="inbox-container">
      <div className="inbox-header">
        <div className="inbox-header__title">
          <button className="topbar__back-btn" onClick={onBack} style={{ marginRight: 12 }}>
            ← Back
          </button>
          <span>💬 Live WhatsApp Inbox</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            className="topbar__btn topbar__btn--secondary"
            onClick={() => setIsLiveSync(!isLiveSync)}
            style={{ fontSize: '0.78rem', padding: '6px 12px' }}
          >
            {isLiveSync ? '⏸ Pause Sync' : '▶ Resume Sync'}
          </button>
          <div className="inbox-header__sync-badge">
            <div className="inbox-header__sync-dot" style={{ animationPlayState: isLiveSync ? 'running' : 'paused', background: isLiveSync ? 'var(--accent-green)' : 'var(--text-muted)' }} />
            <span>{isLiveSync ? 'Real-Time Sync Active (2.5s)' : 'Sync Paused'}</span>
          </div>
        </div>
      </div>

      <div className="inbox-body">
        <div className="inbox-contacts">
          <div className="inbox-contacts__header">
            Contacts ({contactsList.length})
          </div>
          <div className="inbox-contacts__list">
            {contactsList.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No conversations yet
              </div>
            ) : (
              contactsList.map((phone) => {
                const meta = conversationMetadata.find(m => m.contact_phone === phone);
                const displayName = meta?.profile_name || phone;
                return (
                  <div
                    key={phone}
                    className={`inbox-contact-item ${selectedContact === phone ? 'inbox-contact-item--active' : ''}`}
                    onClick={() => setSelectedContact(phone)}
                  >
                    <div className="inbox-contact-item__phone">
                      {displayName}
                      {displayName !== phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{phone}</div>}
                    </div>
                    <div className="inbox-contact-item__count">
                      {contactsMap[phone]?.length || 0}
                    </div>
                  </div>
                );
              })
            )}</div>
        </div>

        <div className="inbox-chat" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="inbox-chat__header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>{selectedContact ? `Conversation with ${selectedContact}` : 'Select a contact'}</span>
              {selectedContact && (
                <span style={{
                  padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600,
                  backgroundColor: (conversationMetadata.find(m => m.contact_phone === selectedContact)?.operator || 'bot') === 'human' ? '#1976d2' : '#8a2be2',
                  color: '#fff', textTransform: 'uppercase'
                }}>
                  Operator : {conversationMetadata.find(m => m.contact_phone === selectedContact)?.operator || 'bot'}
                </span>
              )}
              {selectedContact && contactStatusMap[selectedContact] !== 'expired' && (
                <select
                  value={contactStatusMap[selectedContact] || 'open'}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  style={{
                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600,
                    backgroundColor: (contactStatusMap[selectedContact] || 'open') === 'solved' ? '#2e7d32' : 'var(--bg-tertiary)',
                    color: '#fff', border: '1px solid var(--border-color)', outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value="open">Open</option>
                  <option value="solved">Solved</option>
                </select>
              )}
            </div>
            {selectedContact && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 'normal' }}>
                Total Messages: {activeMessages.length}
              </span>
            )}
          </div>

          <div className="inbox-chat__messages" style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div className="inbox-empty">Loading sync messages...</div>
            ) : !selectedContact ? (
              <div className="inbox-empty">
                <span style={{ fontSize: 40 }}>👈</span>
                <span>Select a contact from the sidebar to view live synced messages.</span>
              </div>
            ) : sortedChat.length === 0 ? (
              <div className="inbox-empty">No messages recorded for this contact.</div>
            ) : (
              sortedChat.map((msg, index) => {
                const prevMsg = index > 0 ? sortedChat[index - 1] : null;
                const isHandoffTransition = msg.operator === 'human' && msg.direction === 'outgoing' && prevMsg && prevMsg.operator === 'bot';
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column' }}>
                    {isHandoffTransition && (
                      <div className="inbox-system-event">
                        Workflow is stopped and set to completed. The operator is now &apos;human&apos;.
                      </div>
                    )}
                    {msg.direction === 'system' ? (
                      <div className="inbox-system-event">
                        {msg.text}
                      </div>
                    ) : (
                      <div className={`message-bubble message-bubble--${msg.direction}`}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                          {msg.operator === 'bot' && msg.direction === 'outgoing' && (
                            <span style={{ fontSize: '1.1rem', marginTop: '-2px' }}>🤖</span>
                          )}
                          <div style={{ flex: 1, wordBreak: 'break-word', minWidth: (msg.metadata?.options || msg.metadata?.list_config) ? '200px' : 'auto' }}>
                            {renderMessageContent(msg, sortedChat)}
                          </div>
                        </div>
                        <div className="message-bubble__meta">
                          <span>{formatTime(msg.created_at)}</span>
                          {msg.direction === 'outgoing' ? renderStatusIcon(msg.status) : <span className="message-bubble__status">({msg.status})</span>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {(contactStatusMap[selectedContact] || 'open') === 'solved' && (
              <div className="inbox-system-event" style={{ marginTop: '12px' }}>
                This chat is resolved
              </div>
            )}
          </div>

          {selectedContact && (
            (contactStatusMap[selectedContact] === 'expired') ? (
              <div style={{
                padding: '16px',
                backgroundColor: 'var(--bg-secondary)',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>This chat is marked as expired</div>
                <div style={{ color: '#aaa', fontSize: '13px', lineHeight: '1.4' }}>
                  Chats are marked as expired 24 hours after the last received customer message. WhatsApp allows only template messages to be sent in such chats. <a href="#" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>Know More</a>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                  <button style={{
                    padding: '10px 20px', borderRadius: '6px', border: 'none',
                    backgroundColor: 'var(--accent-green)', color: '#fff',
                    fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
                  }}>
                    Select Template
                  </button>
                </div>
              </div>
            ) : (contactStatusMap[selectedContact] || 'open') === 'solved' ? (
              <div className="chat-resolved-banner">
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>This chat is resolved</div>
                <div style={{ color: '#aaa', fontSize: '13px', margin: '4px 0 12px 0' }}>
                  You can reopen the chat to follow up with the customer without triggering automated workflows.
                </div>
                <button onClick={() => handleStatusChange('open')} className="btn-reopen">
                  Reopen Chat
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendReply} style={{
                display: 'flex', gap: '10px', padding: '16px', backgroundColor: 'var(--bg-secondary)',
                borderTop: '1px solid var(--border-color)',
              }}>
                <input
                  type="text"
                  placeholder={`Send live WhatsApp message to ${selectedContact}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  disabled={replyLoading}
                  style={{
                    flex: 1, padding: '12px 16px', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)', color: '#fff', outline: 'none', fontSize: '0.9rem',
                  }}
                />
                <button
                  type="submit"
                  disabled={replyLoading || !replyText.trim()}
                  style={{
                    padding: '12px 24px', borderRadius: '8px', border: 'none',
                    background: 'linear-gradient(135deg, var(--accent-green), #2e7d32)', color: '#fff',
                    fontWeight: 600, cursor: replyLoading ? 'not-allowed' : 'pointer', fontSize: '0.9rem',
                    opacity: replyLoading || !replyText.trim() ? 0.6 : 1,
                  }}
                >
                  {replyLoading ? 'Sending...' : '🚀 Send Reply'}
                </button>
              </form>
            )
          )}
        </div>

        {selectedContact && (
          <div className="inbox-ctwa-sidebar" style={{ width: '280px', borderLeft: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>Contact Info</div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem', flex: 1, overflowY: 'auto' }}>
              {(() => {
                const meta = conversationMetadata.find(m => m.contact_phone === selectedContact);
                return (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Phone Number</span>
                      <span>{selectedContact}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>WhatsApp Username</span>
                      <span>{meta?.profile_name || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Source</span>
                      <span style={{ color: meta?.source === 'CTWA' ? 'var(--accent-green)' : 'inherit' }}>
                        {meta?.source || 'Organic'}
                      </span>
                    </div>

                    <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                      <div style={{ fontWeight: 600, marginBottom: '16px' }}>Contact Attributes</div>
                      {meta?.source === 'CTWA' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Headline</span>
                            <span style={{ wordBreak: 'break-word' }}>{meta?.headline || 'N/A'}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Ad ID</span>
                            <span style={{ wordBreak: 'break-all' }}>{meta?.source_id || 'N/A'}</span>
                          </div>
                          {meta?.source_url && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Ad Link</span>
                              <a href={meta.source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none', wordBreak: 'break-all' }}>View Ad ↗</a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No ad attributes found.</div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
