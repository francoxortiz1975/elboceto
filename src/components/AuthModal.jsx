import React, { useEffect, useState } from 'react';
import { X, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const RESEND_SECONDS = 60; // Supabase allows one email per minute

export function AuthModal({ onClose }) {
  const { signInWithOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState('email'); // email | code
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendEmail = async () => {
    setBusy(true);
    setErrorMsg('');
    const { error } = await signInWithOtp(email.trim());
    setBusy(false);
    if (error) { setErrorMsg(error.message); return false; }
    setCooldown(RESEND_SECONDS);
    return true;
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (await sendEmail()) { setStep('code'); setNotice(''); setCode(''); }
  };

  const handleResend = async () => {
    if (cooldown > 0 || busy) return;
    if (await sendEmail()) setNotice('Te mandamos otro correo.');
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length < 6 || busy) return;
    setBusy(true);
    setErrorMsg('');
    const { error } = await verifyOtp(email.trim(), code);
    setBusy(false);
    if (error) {
      setErrorMsg('El código es incorrecto o ya venció. Revisa el último correo o pide uno nuevo.');
      return;
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)',
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

        {step === 'code' ? (
          <form onSubmit={handleVerify}>
            <div className="home-pin-desc">
              Te mandamos un correo a <strong>{email}</strong>. Abre el link, o escribe aquí el código que trae.
            </div>
            <input
              id="auth-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              autoFocus
              placeholder="Código"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="note-title-input font-mono"
              style={{ width: '100%', margin: '10px 0', boxSizing: 'border-box', letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.05rem' }}
            />
            {errorMsg && (
              <div style={{ color: 'var(--danger)', fontSize: '0.72rem', marginBottom: '8px' }}>{errorMsg}</div>
            )}
            {notice && !errorMsg && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '8px' }}>{notice}</div>
            )}
            <div className="home-pin-actions" style={{ flexWrap: 'wrap', rowGap: '6px' }}>
              <button type="button" className="btn-pin-cancel font-mono" onClick={() => { setStep('email'); setErrorMsg(''); }}>
                Cambiar email
              </button>
              <button type="button" className="btn-pin-cancel font-mono" onClick={handleResend} disabled={cooldown > 0 || busy}>
                {cooldown > 0 ? `Reenviar (${cooldown}s)` : 'Reenviar'}
              </button>
              <button type="submit" className="btn-pin-confirm font-mono" disabled={busy || code.length < 6}>
                {busy ? 'Entrando…' : 'Entrar'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSend}>
            <div className="home-pin-desc">
              Ingresá tu email para guardar tus notas y acceder desde otros dispositivos. Te mandamos un link y un código para entrar.
            </div>
            <input
              id="auth-email"
              type="email"
              autoFocus
              required
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="note-title-input"
              style={{ width: '100%', margin: '10px 0', boxSizing: 'border-box' }}
            />
            {errorMsg && (
              <div style={{ color: 'var(--danger)', fontSize: '0.72rem', marginBottom: '8px' }}>{errorMsg}</div>
            )}
            <div className="home-pin-actions">
              <button type="button" className="btn-pin-cancel font-mono" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn-pin-confirm font-mono" disabled={busy}>
                {busy ? 'Enviando…' : 'Enviar link y código'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
