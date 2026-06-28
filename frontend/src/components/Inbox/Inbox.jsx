import { useState, useEffect } from 'react';
import { fetchClientMessages, sendHumanReply } from '../../api/client';
import './Inbox.css';

export default function Inbox({ onBack, clientId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState(null);
  const [isLiveSync, setIsLiveSync] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await fetchClientMessages(clientId, 200);
      setMessages(data || []);
      
      // Auto-select first contact if none selected
      if (!selectedContact && data && data.length > 0) {
        const firstPhone = data[0].contact_phone;
        setSelectedContact(firstPhone);
      }
    } catch (err) {
      console.error('Failed to load live inbox messages:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  // Poll every 2.5s for real-time sync
  useEffect(() => {
    if (!isLiveSync) return;
    const interval = setInterval(() => {
      loadMessages(true);
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

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
              contactsList.map((phone) => (
                <div
                  key={phone}
                  className={`inbox-contact-item ${selectedContact === phone ? 'inbox-contact-item--active' : ''}`}
                  onClick={() => setSelectedContact(phone)}
                >
                  <span className="inbox-contact-item__phone">📱 {phone}</span>
                  <span className="inbox-contact-item__count">{contactsMap[phone].length}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="inbox-chat" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="inbox-chat__header">
            <span>{selectedContact ? `Conversation with ${selectedContact}` : 'Select a contact'}</span>
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
              sortedChat.map((msg) => (
                <div
                  key={msg.id}
                  className={`message-bubble message-bubble--${msg.direction}`}
                >
                  <div>{resolveMessageLabel(msg.text, sortedChat)}</div>
                  <div className="message-bubble__meta">
                    <span>{formatTime(msg.created_at)}</span>
                    <span className="message-bubble__status">({msg.status})</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedContact && (
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
          )}
        </div>
      </div>
    </div>
  );
}
