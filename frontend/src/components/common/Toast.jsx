import { useState, useEffect } from 'react';

const TOAST_DURATION = 3000;

let toastId = 0;
let addToastFn = null;

export function showToast(message, type = 'info') {
  if (addToastFn) {
    addToastFn({ id: ++toastId, message, type });
  }
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    addToastFn = (toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, TOAST_DURATION);
    };
    return () => { addToastFn = null; };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 'var(--z-toast)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            padding: '10px 18px',
            borderRadius: 'var(--radius-md)',
            background: toast.type === 'error'
              ? 'rgba(239, 68, 68, 0.9)'
              : toast.type === 'success'
              ? 'rgba(16, 185, 129, 0.9)'
              : 'rgba(99, 102, 241, 0.9)',
            color: 'white',
            fontSize: '0.85rem',
            fontWeight: 500,
            backdropFilter: 'blur(8px)',
            boxShadow: 'var(--shadow-lg)',
            animation: 'slideInRight var(--transition-normal) ease-out',
            cursor: 'pointer',
            maxWidth: 360,
          }}
          onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
        >
          {toast.type === 'success' && '✓ '}
          {toast.type === 'error' && '✕ '}
          {toast.message}
        </div>
      ))}
    </div>
  );
}
