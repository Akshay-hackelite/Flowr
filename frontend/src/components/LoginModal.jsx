import React, { useState } from 'react';
import { loginUser, signupUser, googleAuthUser } from '../api/client';

export default function LoginModal({ isOpen, onClose, onAuthSuccess, canClose = true }) {
  const [isSignup, setIsSignup] = useState(false);
  const [isGoogleStep, setIsGoogleStep] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [clientName, setClientName] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isGoogleStep) {
        const data = await googleAuthUser({
          email: email || 'user@gmail.com',
          name: userName || 'Google User',
          client_name: clientName || 'My Google Workspace',
          phone_number_id: phoneNumberId || undefined,
          whatsapp_business_account_id: wabaId || undefined,
        });
        onAuthSuccess(data);
        onClose();
      } else if (isSignup) {
        if (!clientName || !userName || !email || !password || !phoneNumberId || !wabaId) {
          throw new Error('Please fill in all required fields including Phone Number ID and WABA ID.');
        }
        const data = await signupUser({
          client_name: clientName,
          user_name: userName,
          email,
          password,
          phone_number_id: phoneNumberId,
          whatsapp_business_account_id: wabaId,
        });
        onAuthSuccess(data);
        onClose();
      } else {
        if (!email || !password) {
          throw new Error('Please enter email and password.');
        }
        const data = await loginUser({ email, password });
        onAuthSuccess(data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const startGoogleFlow = () => {
    setIsGoogleStep(true);
    setEmail('alex.google@flowr.ai');
    setUserName('Alex Rivera');
    setClientName('Rivera Enterprise Automation');
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(10, 10, 18, 0.85)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#161622', border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px', width: '460px', padding: '32px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        color: '#fff', position: 'relative', maxHeight: '90vh', overflowY: 'auto',
      }}>
        {canClose && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '16px', right: '16px', background: 'none',
              border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #ff6b6b, #4ecdc4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px auto', fontSize: '24px', fontWeight: 'bold',
          }}>
            ⚡
          </div>
          <h2 style={{ fontSize: '22px', margin: '0 0 6px 0', fontWeight: 600 }}>
            {isGoogleStep ? 'Complete Google Login' : isSignup ? 'Create Flowr Account' : 'Welcome back to Flowr'}
          </h2>
          <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>
            {isGoogleStep
              ? 'Confirm your details to finish setting up your workspace.'
              : isSignup
              ? 'Build automated WhatsApp workflows in minutes.'
              : 'Enter your credentials to access your client workflows.'}
          </p>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', backgroundColor: 'rgba(255, 87, 34, 0.15)',
            border: '1px solid #ff5722', borderRadius: '8px', color: '#ff8a65',
            fontSize: '13px', marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {(isSignup || isGoogleStep) && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>
                  Workspace / Client Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    backgroundColor: '#1f1f30', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>
                  Your Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    backgroundColor: '#1f1f30', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>
                  WhatsApp Phone Number ID *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1128161027055823"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    backgroundColor: '#1f1f30', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>
                  WhatsApp Business Account (WABA) ID *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1312524951084235"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    backgroundColor: '#1f1f30', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>
              Email Address
            </label>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '8px',
                backgroundColor: '#1f1f30', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {!isGoogleStep && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>
                Password (Plain text as per dev specs)
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  backgroundColor: '#1f1f30', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg, #ff6b6b, #ff8e53)',
              color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '8px', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Processing...' : isGoogleStep ? 'Save & Continue' : isSignup ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        {!isGoogleStep && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: '#666' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
              <span style={{ padding: '0 10px', fontSize: '12px' }}>OR</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
            </div>

            <button
              type="button"
              onClick={startGoogleFlow}
              style={{
                width: '100%', padding: '10px', borderRadius: '8px',
                backgroundColor: '#252538', border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '10px', cursor: 'pointer', fontWeight: 500, fontSize: '14px',
              }}
            >
              <span style={{ fontSize: '18px' }}>🌐</span> Continue with Google
            </button>
          </>
        )}

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: '#888' }}>
          {isGoogleStep ? (
            <span onClick={() => setIsGoogleStep(false)} style={{ color: '#4ecdc4', cursor: 'pointer' }}>
              ← Back to standard auth
            </span>
          ) : isSignup ? (
            <>
              Already have an account?{' '}
              <span onClick={() => { setIsSignup(false); setError(''); }} style={{ color: '#4ecdc4', cursor: 'pointer', fontWeight: 600 }}>
                Log In
              </span>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <span onClick={() => { setIsSignup(true); setError(''); }} style={{ color: '#4ecdc4', cursor: 'pointer', fontWeight: 600 }}>
                Sign Up
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
