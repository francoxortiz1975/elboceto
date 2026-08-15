import React, { useState } from 'react';
import { X, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function AuthModal({ onClose }) {
  const { signInWithOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    const { error } = await signInWithOtp(email.trim());
    if (error) {
      setErrorMsg(error.message);
      setStatus('error');
    } else {
      setStatus('sent');
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(24,24,27,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
      }}
      onClick={onClose}
    >
      <div
        className="home-pin-popover"
        style={{ position: 'relative', width: '320px', maxWidth: '90vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="btn-icon"
          style={{ position: 'absolute', top: '8px', right: '8px', padding: '4px' }}
          onClick={onClose}
          title="Cerrar"
        >
          <X size={14} />
        </button>

        <div className="home-pin-title font-mono">
          <Mail size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
          Iniciar sesión
        </div>

        {status === 'sent' ? (
          <div className="home-pin-desc">
            Revisá tu correo — te mandamos un link para entrar a <strong>{email}</strong>.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="home-pin-desc">
              Ingresá tu email para guardar tus notas y acceder desde otros dispositivos.
            </div>
            <input
              type="email"
              autoFocus
              required
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="note-title-input"
              style={{ width: '100%', margin: '10px 0', boxSizing: 'border-box' }}
            />
            {status === 'error' && (
              <div style={{ color: '#b91c1c', fontSize: '0.72rem', marginBottom: '8px' }}>
                {errorMsg}
              </div>
            )}
            <div className="home-pin-actions">
              <button type="button" className="btn-pin-cancel font-mono" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn-pin-confirm font-mono" disabled={status === 'sending'}>
                {status === 'sending' ? 'Enviando…' : 'Enviar link mágico'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
